import {ToolError, toToolError} from "./tool-error.js";
import type {ToolContext} from "./types.js";
import type {ToolRegistry} from "./tool-registry.js";

export class ToolRunner {
  constructor(private readonly registry: ToolRegistry) {}

  async run(name: string, input: unknown, context: ToolContext): Promise<unknown> {
    const tool = this.registry.get(name);

    if (!tool) {
      throw new ToolError({
        code: "TOOL_NOT_FOUND",
        message: `Tool "${name}" is not registered.`,
        toolName: name,
      });
    }

    try {
      // Future extension point: parameter validation, timeout, and lifecycle events.
      return await tool.execute(input, context);
    } catch (error) {
      throw toToolError(error, {
        code: "TOOL_EXECUTION_FAILED",
        message: `Tool "${name}" failed.`,
        toolName: name,
      });
    }
  }
}
