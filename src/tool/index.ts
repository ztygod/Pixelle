import {bashTool} from "./bash/index.js";
import {
  editFileTool,
  globTool,
  grepTool,
  readFileTool,
  writeFileTool,
} from "./fs/index.js";
import {ToolRegistry} from "./tool-registry.js";
import {webFetchTool} from "./web/index.js";

export {bashTool} from "./bash/index.js";
export {
  editFileTool,
  globTool,
  grepTool,
  readFileTool,
  writeFileTool,
} from "./fs/index.js";
export {toLLMToolParametersSchema} from "./tool-parameters.js";
export {ToolError, toToolError} from "./tool-error.js";
export {ToolRegistry} from "./tool-registry.js";
export {errorToolResult, okToolResult} from "./tool-result.js";
export {ToolRunner} from "./tool-runner.js";
export {
  DEFAULT_WEB_FETCH_MAX_LENGTH,
  DEFAULT_WEB_FETCH_TIMEOUT_MS,
  MAX_WEB_FETCH_MAX_LENGTH,
  MAX_WEB_FETCH_TIMEOUT_MS,
  webFetchTool,
} from "./web/index.js";
export type {ToolErrorCode, ToolErrorOptions} from "./tool-error.js";
export type {LLMToolParametersSchema} from "./tool-parameters.js";
export type {
  ToolRunOptions,
  ToolRunnerEvent,
  ToolRunnerOptions,
} from "./tool-runner-types.js";
export type {ToolErrorResult, ToolResult, ToolSuccessResult} from "./tool-result.js";
export type {
  Tool,
  ToolContext,
  ToolDefinition,
  ToolExecute,
  ToolFileWriter,
  ToolParameterSchema,
  ToolPermissions,
} from "./types.js";

/** Creates the standard tool registry used by Agent when no custom registry is supplied. */
export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(bashTool);
  registry.register(readFileTool);
  registry.register(editFileTool);
  registry.register(writeFileTool);
  registry.register(globTool);
  registry.register(grepTool);
  registry.register(webFetchTool);

  return registry;
}
