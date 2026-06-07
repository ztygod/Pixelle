import {readFile} from "node:fs/promises";

import {ToolError} from "../tool-error.js";
import type {Tool, ToolContext} from "../types.js";
import {resolveWorkspacePath} from "../../utils/path-safety.js";

type ReadFileInput = {
  path?: unknown;
};

export const readFileTool: Tool<ReadFileInput, {path: string; content: string}> = {
  definition: {
    name: "read_file",
    description: "Read a UTF-8 text file from inside the workspace.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Relative path inside the workspace.",
        },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  async execute(input, context) {
    requireReadPermission(context, "read_file");

    if (typeof input?.path !== "string") {
      throw new ToolError({
        code: "TOOL_INVALID_INPUT",
        message: "read_file requires a string path.",
        toolName: "read_file",
      });
    }

    const safePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    const content = await readFile(safePath.absolutePath, "utf8");

    return {
      path: safePath.relativePath,
      content,
    };
  },
};

function requireReadPermission(context: ToolContext, toolName: string): void {
  if (!context.permissions?.readFile) {
    throw new ToolError({
      code: "TOOL_PERMISSION_DENIED",
      message: "File read permission is required.",
      toolName,
    });
  }
}
