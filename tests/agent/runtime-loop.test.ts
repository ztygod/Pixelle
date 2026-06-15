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
import {okToolResult, ToolRegistry, ToolRunner, type Tool} from "../../src/tool/index.js";

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
      toolRunner: new ToolRunner(registry),
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
    expect(events.map((event) => event.type)).toEqual(
      expect.arrayContaining(["tool.call_started", "tool.call_completed"]),
    );
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
