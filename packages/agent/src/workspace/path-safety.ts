import path from "node:path";

import {ToolError} from "../tool/tool-error.js";

export type SafeWorkspacePath = {
  absolutePath: string;
  relativePath: string;
};

export function resolveWorkspacePath(
  workspaceRoot: string,
  inputPath: string,
): SafeWorkspacePath {
  if (!inputPath || typeof inputPath !== "string") {
    throw new ToolError({
      code: "TOOL_INVALID_INPUT",
      message: "Path must be a non-empty string.",
    });
  }

  if (path.isAbsolute(inputPath)) {
    throw new ToolError({
      code: "TOOL_PATH_OUTSIDE_WORKSPACE",
      message: "Absolute paths are not allowed.",
      details: {path: inputPath},
    });
  }

  const root = path.resolve(workspaceRoot);
  const absolutePath = path.resolve(root, inputPath);
  const relativePath = path.relative(root, absolutePath);

  // Reject traversal that resolves outside workspaceRoot.
  if (
    relativePath === ".." ||
    relativePath.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relativePath)
  ) {
    throw new ToolError({
      code: "TOOL_PATH_OUTSIDE_WORKSPACE",
      message: "Path resolves outside the workspace.",
      details: {path: inputPath, workspaceRoot},
    });
  }

  return {
    absolutePath,
    relativePath: toPosixPath(relativePath),
  };
}

export function toPosixPath(filePath: string): string {
  return filePath.split(path.sep).join("/");
}
