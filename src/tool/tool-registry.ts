import {ToolError} from "./tool-error.js";
import type {Tool, ToolDefinition} from "./types.js";

type RegisteredTool = Tool<any, unknown>;

/** In-memory registry that owns the set of tools available to a ToolRunner. */
export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  /** Registers a tool by definition name and rejects duplicate names. */
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

  /** Returns a registered tool implementation by name, if one exists. */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /** Returns all registered tool implementations in registration order. */
  list(): RegisteredTool[] {
    return [...this.tools.values()];
  }

  /** Returns cloned tool definitions suitable for exposing to model providers. */
  listDefinitions(): ToolDefinition[] {
    return this.list().map((tool) => ({...tool.definition}));
  }
}
