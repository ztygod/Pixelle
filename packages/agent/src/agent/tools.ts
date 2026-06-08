import type {LLMTool} from "../llm/types.js";
import {
  toLLMToolParametersSchema,
  type ToolContext,
  type ToolPermissions,
  type ToolRegistry,
  type ToolResult,
} from "../tool/index.js";
import {DEFAULT_PERMISSIONS} from "./defaults.js";

/** Converts registered runtime tools into provider-neutral LLM tool schemas. */
export function buildLLMTools(toolRegistry: ToolRegistry): LLMTool[] {
  return toolRegistry.listDefinitions().map((definition) => ({
    name: definition.name,
    description: definition.description,
    inputSchema: toLLMToolParametersSchema(definition.parameters),
  }));
}

/** Merges conservative defaults, agent-level permissions, and per-run overrides. */
export function mergePermissions(
  base?: ToolPermissions,
  override?: ToolPermissions,
): ToolPermissions {
  return {
    ...DEFAULT_PERMISSIONS,
    ...base,
    ...override,
  };
}

/** Builds the execution context passed to ToolRunner. */
export function createToolContext(input: {
  workspaceRoot: string;
  signal?: AbortSignal;
  basePermissions?: ToolPermissions;
  runPermissions?: ToolPermissions;
}): ToolContext {
  return {
    workspaceRoot: input.workspaceRoot,
    signal: input.signal,
    permissions: mergePermissions(input.basePermissions, input.runPermissions),
  };
}

export function stringifyToolResult(result: ToolResult): string {
  return JSON.stringify(result);
}
