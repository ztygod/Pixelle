import {ToolError} from "./tool-error.js";
import type {Tool, ToolDefinition} from "./types.js";

type RegisteredTool = Tool<any, unknown>;

export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(tool: RegisteredTool): void {
    const {name} = tool.definition;

    if (this.tools.has(name)) {
      throw new ToolError({
        code: "TOOL_ALREADY_REGISTERED",
        message: `Tool "${name}" is already registered.`,
        toolName: name,
      });
    }

    this.tools.set(name, tool);
  }

  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  list(): RegisteredTool[] {
    return [...this.tools.values()];
  }

  listDefinitions(): ToolDefinition[] {
    return this.list().map((tool) => ({...tool.definition}));
  }
}
