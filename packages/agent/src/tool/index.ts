import {globTool, grepTool, readFileTool, writeFileTool} from "./fs/index.js";
import {ToolRegistry} from "./tool-registry.js";
import {webFetchTool, webSearchTool} from "./web/index.js";

export {globTool, grepTool, listWorkspaceFiles, readFileTool, writeFileTool} from "./fs/index.js";
export {ToolError, toToolError} from "./tool-error.js";
export {ToolRegistry} from "./tool-registry.js";
export {ToolRunner} from "./tool-runner.js";
export {resolveWorkspacePath, toPosixPath} from "../utils/path-safety.js";
export {webFetchTool, webSearchTool} from "./web/index.js";
export type {SafeWorkspacePath} from "../utils/path-safety.js";
export type {ToolErrorCode, ToolErrorOptions} from "./tool-error.js";
export type {
  Tool,
  ToolContext,
  ToolDefinition,
  ToolExecute,
  ToolPermissions,
} from "./types.js";

export function createDefaultToolRegistry(): ToolRegistry {
  const registry = new ToolRegistry();

  registry.register(readFileTool);
  registry.register(writeFileTool);
  registry.register(globTool);
  registry.register(grepTool);
  registry.register(webFetchTool);
  registry.register(webSearchTool);

  return registry;
}
