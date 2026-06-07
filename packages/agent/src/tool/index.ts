import {bashTool} from "./bash/index.js";
import {globTool, grepTool, readFileTool, writeFileTool} from "./fs/index.js";
import {ToolRegistry} from "./tool-registry.js";
import {webFetchTool, webSearchTool} from "./web/index.js";

export {bashTool} from "./bash/index.js";
export {globTool, grepTool, listWorkspaceFiles, readFileTool, writeFileTool} from "./fs/index.js";
export {toLLMToolParametersSchema} from "./tool-parameters.js";
export {ToolError, toToolError} from "./tool-error.js";
export {ToolRegistry} from "./tool-registry.js";
export {errorToolResult, okToolResult} from "./tool-result.js";
export {ToolRunner} from "./tool-runner.js";
export {resolveWorkspacePath, toPosixPath} from "../utils/path-safety.js";
export {webFetchTool, webSearchTool} from "./web/index.js";
export type {SafeWorkspacePath} from "../utils/path-safety.js";
export type {ToolErrorCode, ToolErrorOptions} from "./tool-error.js";
export type {
  LLMToolParametersSchema,
  ToolParametersSchemaConverter,
} from "./tool-parameters.js";
export type {ToolErrorResult, ToolResult, ToolSuccessResult} from "./tool-result.js";
export type {
  Tool,
  ToolContext,
  ToolDefinition,
  ToolExecute,
  ToolParameterSchema,
  ToolPermissions,
} from "./types.js";

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(bashTool);
  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(globTool);
  registry.register(grepTool);
  registry.register(webFetchTool);
  registry.register(webSearchTool);

  return registry;
}
