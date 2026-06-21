import {mkdtemp} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";

import {z} from "zod";
import {describe, expect, it} from "vitest";

import {Agent} from "../../src/agent/index.js";
import {EventBus, type PixelleEvent} from "../../src/events/index.js";
import {BaseLLMClient} from "../../src/llm/index.js";
import type {
  LLMGenerateInput,
  LLMResponse,
  LLMStreamChunk,
  LLMStreamInput,
} from "../../src/llm/types.js";
import type {
  CommandPolicyDecision,
  CommandPolicyEvaluateInput,
  CommandPolicyLike,
  WorkspaceProfile,
} from "../../src/runtime/index.js";
import {
  errorToolResult,
  okToolResult,
  ToolRegistry,
  ToolRunner,
  type Tool,
} from "../../src/tool/index.js";

class QueueLLMClient extends BaseLLMClient {
  readonly requests: LLMGenerateInput[] = [];

  constructor(private readonly responses: LLMResponse[]) {
    super();
  }

  override async generate(input: LLMGenerateInput): Promise<LLMResponse> {
    this.requests.push({
      ...input,
      messages: input.messages.map((message) => ({...message})),
      tools: input.tools?.map((tool) => ({...tool})),
    });
    const response = this.responses.shift();
    if (!response) {
      throw new Error("No fake response queued.");
    }

    return response;
  }
}

class StreamingLLMClient extends BaseLLMClient {
  override async generate(): Promise<LLMResponse> {
    throw new Error("generate should not be called.");
  }

  override async *stream(_input: LLMStreamInput): AsyncIterable<LLMStreamChunk> {
    yield {type: "content_delta", content: "Hello"};
    yield {type: "content_delta", content: " world"};
    yield {
      type: "done",
      response: {content: "Hello world", toolCalls: []},
    };
  }
}

async function createWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pixelle-agent-runtime-"));
}

function createWorkspaceScanner(workspaceRoot: string) {
  const profile: WorkspaceProfile = {
    root: workspaceRoot,
    packageManager: "pnpm",
    scripts: {},
    projectFiles: [],
    detectedFrameworks: [],
  };

  return {
    async scan(): Promise<WorkspaceProfile> {
      return profile;
    },
  };
}

function createConfig(workspaceRoot: string) {
  return {
    runtime: {
      maxIterations: 3,
      maxRepairAttempts: 0,
      tokensLimit: 32_000,
      systemPrompt: "Test system prompt.",
      workspaceDir: workspaceRoot,
      rollbackOnFailure: false,
    },
    permissions: {
      readFile: true,
      writeFile: true,
      network: false,
      shell: false,
    },
    verification: {
      enabled: false,
      commands: [],
    },
    trace: {
      enabled: false,
      directory: workspaceRoot,
    },
  };
}

function collectToolEvents(events: readonly PixelleEvent[]): PixelleEvent[] {
  return events.filter((event) => event.type.startsWith("tool.call_"));
}

describe("Agent runtime loop", () => {
  it("completes when the model returns no tool calls", async () => {
    const workspaceRoot = await createWorkspace();
    const llm = new QueueLLMClient([
      {content: "Done.", toolCalls: [], usage: {inputTokens: 1, outputTokens: 2}},
    ]);

    const result = await new Agent({
      config: createConfig(workspaceRoot),
      llm,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
    }).run({prompt: "Say done."});

    expect(result).toMatchObject({
      content: "Done.",
      stopReason: "completed",
      iterations: 1,
      usage: {inputTokens: 1, outputTokens: 2},
    });
    expect(llm.requests[0]?.messages.at(-1)).toMatchObject({
      role: "user",
      content: "Say done.",
    });
  });

  it("executes tool calls and appends tool messages before the next model call", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new ToolRegistry();
    const eventBus = new EventBus<PixelleEvent>();
    const events: PixelleEvent[] = [];
    const echoTool: Tool<z.ZodObject<{text: z.ZodString}>, {text: string}> = {
      definition: {
        name: "echo",
        description: "Echo text.",
        parameters: z.object({text: z.string()}),
      },
      execute: (input) => okToolResult("Echoed.", {text: input.text}),
    };

    registry.register(echoTool);
    eventBus.subscribe((event) => events.push(event));

    const llm = new QueueLLMClient([
      {
        content: "I will use a tool.",
        toolCalls: [{id: "call-1", name: "echo", arguments: {text: "hello"}}],
      },
      {content: "Tool result received.", toolCalls: []},
    ]);

    const result = await new Agent({
      config: createConfig(workspaceRoot),
      llm,
      toolRegistry: registry,
      eventBus,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
    }).run({prompt: "Use echo."});

    expect(result.stopReason).toBe("completed");
    expect(result.toolResults).toHaveLength(1);
    expect(result.messages.some((message) => message.role === "tool")).toBe(true);
    expect(llm.requests[1]?.messages.at(-1)).toMatchObject({
      role: "tool",
      toolCallId: "call-1",
      name: "echo",
    });
    expect(collectToolEvents(events).map((event) => event.type)).toEqual([
      "tool.call_started",
      "tool.call_completed",
    ]);
    expect(collectToolEvents(events)[0]).toMatchObject({
      type: "tool.call_started",
      id: "call-1",
      name: "echo",
      input: {text: "hello"},
      metadata: {source: "agent"},
    });
    expect(collectToolEvents(events)[1]).toMatchObject({
      type: "tool.call_completed",
      id: "call-1",
      name: "echo",
      result: {
        ok: true,
        message: "Echoed.",
        data: {text: "hello"},
      },
      output: {text: "hello"},
      summary: "Echoed.",
    });
  });

  it("rebuilds runtime context each model request and archives older tool results", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new ToolRegistry();
    const beforeModelBuildCounts: number[] = [];
    const longOutput = "0123456789".repeat(1_500);

    registry.register({
      definition: {
        name: "large_output",
        description: "Returns a large output.",
        parameters: z.object({label: z.string()}),
      },
      execute: (input: {label: string}) =>
        okToolResult("Large output.", {
          label: input.label,
          output: input.label === "first" ? longOutput : "short output",
        }),
    });

    const llm = new QueueLLMClient([
      {
        content: "First call.",
        toolCalls: [
          {id: "call-first", name: "large_output", arguments: {label: "first"}},
        ],
      },
      {
        content: "Second call.",
        toolCalls: [
          {id: "call-second", name: "large_output", arguments: {label: "second"}},
        ],
      },
      {content: "Done.", toolCalls: []},
    ]);

    const config = createConfig(workspaceRoot);
    config.runtime.tokensLimit = 2_000;
    config.runtime.maxIterations = 4;

    const result = await new Agent({
      config,
      llm,
      toolRegistry: registry,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
      middleware: [
        {
          beforeModel: (_request, context) => {
            beforeModelBuildCounts.push(context.contextBuilds?.length ?? 0);
          },
        },
      ],
    }).run({prompt: "Use large output."});

    const thirdRequest = llm.requests[2];
    const thirdSystemPrompt = thirdRequest?.messages[0]?.content ?? "";

    expect(result.stopReason).toBe("completed");
    expect(llm.requests).toHaveLength(3);
    expect(beforeModelBuildCounts).toEqual([1, 2, 3]);
    expect(thirdSystemPrompt).toContain("## Tool Result: large_output");
    expect(thirdSystemPrompt).toContain("Call ID: call-first");
    expect(thirdSystemPrompt).toContain("chars omitted");
    expect(
      thirdRequest?.messages.some(
        (message) => message.role === "tool" && message.toolCallId === "call-first",
      ),
    ).toBe(false);
    expect(thirdRequest?.messages.at(-1)).toMatchObject({
      role: "tool",
      toolCallId: "call-second",
      name: "large_output",
    });
  });

  it("emits one failed tool event for execution failures through the ToolRunner adapter", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new ToolRegistry();
    const eventBus = new EventBus<PixelleEvent>();
    const events: PixelleEvent[] = [];

    registry.register({
      definition: {
        name: "fail",
        description: "Fails.",
        parameters: z.object({}),
      },
      execute: () => errorToolResult("Tool failed.", "TOOL_EXECUTION_FAILED", {x: 1}),
    });
    eventBus.subscribe((event) => events.push(event));

    const result = await new Agent({
      config: createConfig(workspaceRoot),
      llm: new QueueLLMClient([
        {
          content: "Failing.",
          toolCalls: [{id: "fail-1", name: "fail", arguments: {}}],
        },
        {content: "Done.", toolCalls: []},
      ]),
      toolRegistry: registry,
      eventBus,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
    }).run({prompt: "Use fail."});

    expect(result.toolResults[0]?.result).toMatchObject({
      ok: false,
      code: "TOOL_EXECUTION_FAILED",
    });
    expect(collectToolEvents(events).map((event) => event.type)).toEqual([
      "tool.call_started",
      "tool.call_failed",
    ]);
    expect(collectToolEvents(events)[1]).toMatchObject({
      type: "tool.call_failed",
      id: "fail-1",
      name: "fail",
      result: {
        ok: false,
        message: "Tool failed.",
        code: "TOOL_EXECUTION_FAILED",
        data: {x: 1},
      },
      error: "Tool failed.",
      code: "TOOL_EXECUTION_FAILED",
      data: {x: 1},
    });
  });

  it("emits terminal tool events after afterTool middleware updates the result", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new ToolRegistry();
    const eventBus = new EventBus<PixelleEvent>();
    const events: PixelleEvent[] = [];

    registry.register({
      definition: {
        name: "echo",
        description: "Echo text.",
        parameters: z.object({text: z.string()}),
      },
      execute: (input: {text: string}) => okToolResult("Original.", input),
    });
    eventBus.subscribe((event) => events.push(event));

    const result = await new Agent({
      config: createConfig(workspaceRoot),
      llm: new QueueLLMClient([
        {
          content: "Echo.",
          toolCalls: [{id: "mw-1", name: "echo", arguments: {text: "hello"}}],
        },
        {content: "Done.", toolCalls: []},
      ]),
      toolRegistry: registry,
      eventBus,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
      middleware: [
        {
          afterTool: (toolResult) => ({
            ...toolResult,
            result: okToolResult("Updated.", {text: "updated"}),
          }),
        },
      ],
    }).run({prompt: "Use echo."});

    expect(result.toolResults[0]?.result).toMatchObject({
      ok: true,
      message: "Updated.",
      data: {text: "updated"},
    });
    expect(collectToolEvents(events).map((event) => event.type)).toEqual([
      "tool.call_started",
      "tool.call_completed",
    ]);
    expect(collectToolEvents(events)[1]).toMatchObject({
      type: "tool.call_completed",
      id: "mw-1",
      result: {
        ok: true,
        message: "Updated.",
        data: {text: "updated"},
      },
      output: {text: "updated"},
      summary: "Updated.",
    });
  });

  it("maps timeout and aborted ToolRunner events to failed agent tool events", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new ToolRegistry();
    const eventBus = new EventBus<PixelleEvent>();
    const events: PixelleEvent[] = [];

    registry.register({
      definition: {
        name: "timeout",
        description: "Returns a timeout result.",
        parameters: z.object({}),
      },
      execute: () => errorToolResult("Timed out.", "TOOL_TIMEOUT", {timeoutMs: 1}),
    });
    registry.register({
      definition: {
        name: "abort",
        description: "Returns an abort result.",
        parameters: z.object({}),
      },
      execute: () => errorToolResult("Aborted.", "TOOL_ABORTED"),
    });
    eventBus.subscribe((event) => events.push(event));

    await new Agent({
      config: createConfig(workspaceRoot),
      llm: new QueueLLMClient([
        {
          content: "Timeout.",
          toolCalls: [{id: "timeout-1", name: "timeout", arguments: {}}],
        },
        {
          content: "Abort.",
          toolCalls: [{id: "abort-1", name: "abort", arguments: {}}],
        },
        {content: "Done.", toolCalls: []},
      ]),
      toolRegistry: registry,
      eventBus,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
    }).run({prompt: "Use timeout and abort."});

    const failedEvents = collectToolEvents(events).filter(
      (event) => event.type === "tool.call_failed",
    );

    expect(failedEvents).toHaveLength(2);
    expect(failedEvents[0]).toMatchObject({
      type: "tool.call_failed",
      id: "timeout-1",
      code: "TOOL_TIMEOUT",
      data: {timeoutMs: 1},
    });
    expect(failedEvents[1]).toMatchObject({
      type: "tool.call_failed",
      id: "abort-1",
      code: "TOOL_ABORTED",
    });
  });

  it("streams tool events emitted by the ToolRunner adapter", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new ToolRegistry();

    registry.register({
      definition: {
        name: "echo",
        description: "Echo text.",
        parameters: z.object({text: z.string()}),
      },
      execute: (input: {text: string}) => okToolResult("Echoed.", input),
    });

    const stream = new Agent({
      config: createConfig(workspaceRoot),
      llm: new QueueLLMClient([
        {content: "Echo.", toolCalls: [{id: "s1", name: "echo", arguments: {text: "a"}}]},
        {content: "Done.", toolCalls: []},
      ]),
      toolRegistry: registry,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
    }).stream({prompt: "Use echo."});
    const events: PixelleEvent[] = [];

    for await (const event of stream) {
      events.push(event);
    }

    expect(collectToolEvents(events).map((event) => event.type)).toEqual([
      "tool.call_started",
      "tool.call_completed",
    ]);
  });

  it("keeps manual agent tool events for injected ToolRunner instances", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new ToolRegistry();
    const eventBus = new EventBus<PixelleEvent>();
    const events: PixelleEvent[] = [];

    registry.register({
      definition: {
        name: "echo",
        description: "Echo text.",
        parameters: z.object({text: z.string()}),
      },
      execute: (input: {text: string}) => okToolResult("Echoed.", input),
    });
    eventBus.subscribe((event) => events.push(event));

    await new Agent({
      config: createConfig(workspaceRoot),
      llm: new QueueLLMClient([
        {content: "Echo.", toolCalls: [{id: "i1", name: "echo", arguments: {text: "a"}}]},
        {content: "Done.", toolCalls: []},
      ]),
      toolRegistry: registry,
      toolRunner: new ToolRunner(registry),
      eventBus,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
    }).run({prompt: "Use echo."});

    expect(collectToolEvents(events).map((event) => event.type)).toEqual([
      "tool.call_started",
      "tool.call_completed",
    ]);
  });

  it("emits assistant deltas while streaming model output", async () => {
    const workspaceRoot = await createWorkspace();
    const events: PixelleEvent[] = [];

    const result = await new Agent({
      config: createConfig(workspaceRoot),
      llm: new StreamingLLMClient(),
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
    }).stream({prompt: "Say hello."});

    for await (const event of result) {
      events.push(event);
    }

    expect(
      events
        .filter((event) => event.type === "conversation.assistant_delta")
        .map((event) =>
          event.type === "conversation.assistant_delta" ? event.delta : "",
        ),
    ).toEqual(["Hello", " world"]);
  });

  it("stops at maxIterations when the model keeps requesting tools", async () => {
    const workspaceRoot = await createWorkspace();
    const registry = new ToolRegistry();
    registry.register({
      definition: {
        name: "echo",
        description: "Echo text.",
        parameters: z.object({text: z.string()}),
      },
      execute: (input: {text: string}) => okToolResult("Echoed.", input),
    });

    const llm = new QueueLLMClient([
      {content: "Again.", toolCalls: [{id: "1", name: "echo", arguments: {text: "a"}}]},
      {content: "Again.", toolCalls: [{id: "2", name: "echo", arguments: {text: "b"}}]},
      {content: "Again.", toolCalls: [{id: "3", name: "echo", arguments: {text: "c"}}]},
    ]);

    const config = createConfig(workspaceRoot);
    config.runtime.maxIterations = 2;

    const result = await new Agent({
      config,
      llm,
      toolRegistry: registry,
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
    }).run({prompt: "Loop."});

    expect(result.stopReason).toBe("max_iterations");
    expect(result.iterations).toBe(2);
    expect(result.toolResults).toHaveLength(2);
  });

  it("passes workspace profile and command policy into tool context", async () => {
    const workspaceRoot = await createWorkspace();
    const profile = createWorkspaceScanner(workspaceRoot);
    const registry = new ToolRegistry();
    const decision: CommandPolicyDecision = {
      effect: "allow",
      allowed: true,
      risk: "low",
      category: "verification",
      ruleId: "test-policy",
      reason: "Allowed by test.",
    };
    const commandPolicy: CommandPolicyLike = {
      evaluate(_input: CommandPolicyEvaluateInput) {
        return decision;
      },
      canRun() {
        return {allowed: true};
      },
    };

    registry.register({
      definition: {
        name: "inspect_context",
        description: "Inspect tool context.",
        parameters: z.object({}),
      },
      execute: (_input, context) =>
        okToolResult("Inspected.", {
          hasPolicy: context.commandPolicy === commandPolicy,
          packageManager: context.workspaceProfile?.packageManager,
        }),
    });

    const llm = new QueueLLMClient([
      {
        content: "Inspecting.",
        toolCalls: [{id: "ctx", name: "inspect_context", arguments: {}}],
      },
      {content: "Done.", toolCalls: []},
    ]);

    const result = await new Agent({
      config: createConfig(workspaceRoot),
      llm,
      toolRegistry: registry,
      workspaceScanner: profile,
      commandPolicy,
    }).run({prompt: "Inspect context."});

    expect(result.toolResults[0]?.result).toMatchObject({
      ok: true,
      data: {hasPolicy: true, packageManager: "pnpm"},
    });
  });

  it("uses injected command policy for verification", async () => {
    const workspaceRoot = await createWorkspace();
    const config = createConfig(workspaceRoot);
    config.verification.enabled = true;
    config.verification.commands = ["pnpm typecheck"];

    const commandPolicy: CommandPolicyLike = {
      evaluate() {
        throw new Error("Verifier should use canRun compatibility.");
      },
      canRun(command) {
        return {
          allowed: false,
          reason: `Rejected by injected policy: ${command}`,
        };
      },
    };

    const result = await new Agent({
      config,
      llm: new QueueLLMClient([{content: "Done.", toolCalls: []}]),
      workspaceScanner: createWorkspaceScanner(workspaceRoot),
      commandPolicy,
    }).run({prompt: "Finish."});

    expect(result.verification).toEqual([
      expect.objectContaining({
        command: "pnpm typecheck",
        exitCode: null,
        passed: false,
        stderr: "Rejected by injected policy: pnpm typecheck",
      }),
    ]);
  });
});
