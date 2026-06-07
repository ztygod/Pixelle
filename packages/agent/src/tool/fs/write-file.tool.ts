import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";

import {ToolError} from "../tool-error.js";
import type {Tool, ToolContext} from "../types.js";
import {resolveWorkspacePath} from "../../utils/path-safety.js";

type WriteFileInput = {
  path?: unknown;
  content?: unknown;
};

export const writeFileTool: Tool<
  WriteFileInput,
  {path: string; bytesWritten: number}
> = {
  definition: {
    name: "write_file",
    description: "Write a complete UTF-8 text file inside the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path inside the workspace.",
        },
        content: {
          type: "string",
          description: "Complete file content to write.",
        },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  async execute(input, context) {
    requireWritePermission(context, "write_file");

    if (typeof input?.path !== "string" || typeof input.content !== "string") {
      throw new ToolError({
        code: "TOOL_INVALID_INPUT",
        message: "write_file requires string path and content.",
        toolName: "write_file",
      });
    }

    const safePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    await mkdir(path.dirname(safePath.absolutePath), {recursive: true});
    await writeFile(safePath.absolutePath, input.content, "utf8");

    return {
      path: safePath.relativePath,
      bytesWritten: Buffer.byteLength(input.content, "utf8"),
    };
  },
};

function requireWritePermission(context: ToolContext, toolName: string): void {
  if (!context.permissions?.writeFile) {
    throw new ToolError({
      code: "TOOL_PERMISSION_DENIED",
      message: "File write permission is required.",
      toolName,
    });
  }
}
