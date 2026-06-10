import {z} from "zod";
import {describe, expect, it} from "vitest";

import {
  okToolResult,
  ToolError,
  ToolRegistry,
  ToolRunner,
  type Tool,
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
});
