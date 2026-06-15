import {z} from "zod";
import {describe, expect, it} from "vitest";

import {
  okToolResult,
  ToolError,
  ToolRegistry,
  ToolRunner,
  type Tool,
  type ToolRunnerEvent,
} from "../../src/tool/index.js";

const echoParameters = z.object({
  text: z.string(),
});

function createEchoTool(name = "echo"): Tool<typeof echoParameters, {text: string}> {
  return {
    definition: {
      name,
      description: "Echo input text.",
      parameters: echoParameters,
    },
    execute: (input) => okToolResult("Echoed text.", {text: input.text}),
  };
}

describe("ToolRegistry", () => {
  it("registers tools and returns copied definitions", () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());

    expect(registry.get("echo")).toBeDefined();
    expect(registry.list()).toHaveLength(1);

    const [definition] = registry.listDefinitions();
    expect(definition).toMatchObject({name: "echo", description: "Echo input text."});
    expect(definition).not.toBe(registry.get("echo")?.definition);
  });

  it("rejects duplicate tool names", () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());

    expect(() => registry.register(createEchoTool())).toThrow(ToolError);
  });
});

describe("ToolRunner", () => {
  it("returns TOOL_NOT_FOUND for unknown tools", async () => {
    const runner = new ToolRunner(new ToolRegistry());

    await expect(
      runner.run("missing", {}, {workspaceRoot: process.cwd()}),
    ).resolves.toMatchObject({
      ok: false,
      code: "TOOL_NOT_FOUND",
    });
  });

  it("validates input before executing a tool", async () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());

    const result = await new ToolRunner(registry).run(
      "echo",
      {text: 42},
      {workspaceRoot: process.cwd()},
    );

    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_INVALID_INPUT",
    });
    expect(result.ok ? undefined : result.data).toHaveProperty("issues");
  });

  it("executes registered tools and normalizes thrown errors", async () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());
    registry.register({
      definition: {
        name: "throws",
        description: "Throws a tool error.",
        parameters: z.object({}),
      },
      execute: () => {
        throw new ToolError({
          code: "TOOL_PERMISSION_DENIED",
          message: "No shell permission.",
        });
      },
    });

    await expect(
      new ToolRunner(registry).run(
        "echo",
        {text: "hello"},
        {workspaceRoot: process.cwd()},
      ),
    ).resolves.toMatchObject({
      ok: true,
      data: {text: "hello"},
    });

    await expect(
      new ToolRunner(registry).run("throws", {}, {workspaceRoot: process.cwd()}),
    ).resolves.toMatchObject({
      ok: false,
      code: "TOOL_PERMISSION_DENIED",
    });
  });

  it("normalizes synchronous and asynchronous execution failures", async () => {
    const registry = new ToolRegistry();
    registry.register({
      definition: {
        name: "sync_throw",
        description: "Throws synchronously.",
        parameters: z.object({}),
      },
      execute: () => {
        throw new Error("sync failed");
      },
    });
    registry.register({
      definition: {
        name: "async_reject",
        description: "Rejects asynchronously.",
        parameters: z.object({}),
      },
      execute: async () => {
        await Promise.resolve();
        throw new Error("async failed");
      },
    });

    await expect(
      new ToolRunner(registry).run("sync_throw", {}, {workspaceRoot: process.cwd()}),
    ).resolves.toMatchObject({
      ok: false,
      code: "TOOL_EXECUTION_FAILED",
      message: "sync failed",
    });

    await expect(
      new ToolRunner(registry).run("async_reject", {}, {workspaceRoot: process.cwd()}),
    ).resolves.toMatchObject({
      ok: false,
      code: "TOOL_EXECUTION_FAILED",
      message: "async failed",
    });
  });

  it("preserves ToolError details", async () => {
    const registry = new ToolRegistry();
    registry.register({
      definition: {
        name: "tool_error",
        description: "Throws a structured tool error.",
        parameters: z.object({}),
      },
      execute: () => {
        throw new ToolError({
          code: "TOOL_PATH_OUTSIDE_WORKSPACE",
          message: "Outside workspace.",
          details: {path: "../secret"},
        });
      },
    });

    await expect(
      new ToolRunner(registry).run("tool_error", {}, {workspaceRoot: process.cwd()}),
    ).resolves.toMatchObject({
      ok: false,
      code: "TOOL_PATH_OUTSIDE_WORKSPACE",
      data: {path: "../secret"},
    });
  });

  it("emits started and completed events with duration metadata", async () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());
    const events: ToolRunnerEvent[] = [];
    const times = [100, 135];

    const result = await new ToolRunner(registry, {
      createCallId: () => "call-1",
      now: () => times.shift() ?? 135,
      onEvent: (event) => {
        events.push(event);
      },
    }).run(
      "echo",
      {text: "hello"},
      {workspaceRoot: process.cwd()},
      {metadata: {traceId: "trace-1"}},
    );

    expect(result).toMatchObject({ok: true});
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      type: "runner.tool.started",
      callId: "call-1",
      toolName: "echo",
      startedAt: 100,
      timeoutMs: 30_000,
      metadata: {traceId: "trace-1"},
    });
    expect(events[1]).toMatchObject({
      type: "runner.tool.completed",
      callId: "call-1",
      toolName: "echo",
      startedAt: 100,
      endedAt: 135,
      durationMs: 35,
      result: {ok: true, data: {text: "hello"}},
      metadata: {traceId: "trace-1"},
    });
  });

  it("emits failed events for error results", async () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());
    const events: ToolRunnerEvent[] = [];

    const result = await new ToolRunner(registry, {
      onEvent: (event) => {
        events.push(event);
      },
    }).run("echo", {text: 42}, {workspaceRoot: process.cwd()});

    expect(result).toMatchObject({ok: false, code: "TOOL_INVALID_INPUT"});
    expect(events.map((event) => event.type)).toEqual([
      "runner.tool.started",
      "runner.tool.failed",
    ]);
    expect(events[1]).toMatchObject({
      errorCode: "TOOL_INVALID_INPUT",
      result: {ok: false, code: "TOOL_INVALID_INPUT"},
    });
  });

  it("returns TOOL_TIMEOUT when the runner timeout wins", async () => {
    const registry = new ToolRegistry();
    registry.register({
      definition: {
        name: "never",
        description: "Never resolves.",
        parameters: z.object({}),
      },
      execute: () => new Promise(() => undefined),
    });
    const events: ToolRunnerEvent[] = [];

    const result = await new ToolRunner(registry, {
      defaultTimeoutMs: 1,
      onEvent: (event) => {
        events.push(event);
      },
    }).run("never", {}, {workspaceRoot: process.cwd()});

    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_TIMEOUT",
      data: {timeoutMs: 1},
    });
    expect(events.map((event) => event.type)).toEqual([
      "runner.tool.started",
      "runner.tool.timed_out",
    ]);
    expect(events[1]).toMatchObject({
      errorCode: "TOOL_TIMEOUT",
    });
    expect("durationMs" in events[1]).toBe(true);
  });

  it("returns TOOL_ABORTED when an external signal aborts", async () => {
    const registry = new ToolRegistry();
    let executed = false;
    registry.register({
      definition: {
        name: "abortable",
        description: "Should not execute after pre-abort.",
        parameters: z.object({}),
      },
      execute: () => {
        executed = true;
        return okToolResult("Executed.", {});
      },
    });
    const controller = new AbortController();
    controller.abort();
    const events: ToolRunnerEvent[] = [];

    const result = await new ToolRunner(registry, {
      onEvent: (event) => {
        events.push(event);
      },
    }).run("abortable", {}, {workspaceRoot: process.cwd()}, {signal: controller.signal});

    expect(executed).toBe(false);
    expect(result).toMatchObject({ok: false, code: "TOOL_ABORTED"});
    expect(events.map((event) => event.type)).toEqual([
      "runner.tool.started",
      "runner.tool.aborted",
    ]);
    expect(events[1]).toMatchObject({
      errorCode: "TOOL_ABORTED",
    });
    expect("durationMs" in events[1]).toBe(true);
  });

  it("injects a runner-controlled signal into ToolContext", async () => {
    const registry = new ToolRegistry();
    let injectedSignal: AbortSignal | undefined;
    registry.register({
      definition: {
        name: "signal",
        description: "Captures context signal.",
        parameters: z.object({}),
      },
      execute: (_input, context) => {
        injectedSignal = context.signal;
        return okToolResult("Captured signal.", {hasSignal: Boolean(context.signal)});
      },
    });

    const result = await new ToolRunner(registry).run(
      "signal",
      {},
      {workspaceRoot: process.cwd()},
      {timeoutMs: false},
    );

    expect(result).toMatchObject({ok: true, data: {hasSignal: true}});
    expect(injectedSignal).toBeInstanceOf(AbortSignal);
  });

  it("does not let event callback failures affect execution", async () => {
    const registry = new ToolRegistry();
    registry.register(createEchoTool());

    await expect(
      new ToolRunner(registry, {
        onEvent: () => {
          throw new Error("observer failed");
        },
      }).run("echo", {text: "hello"}, {workspaceRoot: process.cwd()}),
    ).resolves.toMatchObject({
      ok: true,
      data: {text: "hello"},
    });
  });
});
