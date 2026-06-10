import {ToolError} from "./tool-error.js";
import {errorToolResult} from "./tool-result.js";
import type {ToolContext, ToolResult} from "./types.js";
import type {ToolRegistry} from "./tool-registry.js";

export class ToolRunner {
  constructor(private readonly registry: ToolRegistry) {}

  async run(name: string, input: unknown, context: ToolContext): Promise<ToolResult> {
    const tool = this.registry.get(name);

    if (!tool) {
      return errorToolResult(`Tool "${name}" is not registered.`, "TOOL_NOT_FOUND");
    }

    const parsedInput = tool.definition.parameters.safeParse(input);

    if (!parsedInput.success) {
      // Validation errors are returned to the agent loop as structured tool results.
      return errorToolResult(`Invalid input for tool "${name}".`, "TOOL_INVALID_INPUT", {
        issues: parsedInput.error.issues,
      });
    }

    try {
      // Future extension point: timeout and lifecycle events.
      return await tool.execute(parsedInput.data, context);
    } catch (error) {
      if (error instanceof ToolError) {
        return errorToolResult(error.message, error.code, error.details);
      }

      return errorToolResult(
        error instanceof Error ? error.message : `Tool "${name}" failed.`,
        "TOOL_EXECUTION_FAILED",
      );
    }
  }
}
