import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";
import {resolveWorkspacePath} from "../../utils/path-safety.js";

const writeFileParameters = z.object({
  reason: z
    .string()
    .describe(
      "Explain why you are calling this tool and what you expect to learn or change.",
    ),
  path: z
    .string()
    .min(1)
    .describe(
      "Workspace-relative path to write. The path must stay inside workspaceRoot.",
    ),
  content: z
    .string()
    .describe(
      "Complete UTF-8 file content to write. This replaces the whole file, so read the current file first when preserving existing content matters.",
    ),
});

export const writeFileTool: Tool<
  typeof writeFileParameters,
  {path: string; bytesWritten: number}
> = {
  definition: {
    name: "write_file",
    description:
      "Write complete UTF-8 content to a file inside workspaceRoot, creating parent directories when needed. Use this only when you intend to create or replace a whole file. Before changing an existing file, read_file should usually be called first to understand the current content. This tool cannot write outside workspaceRoot. Returns the normalized path and byte count written.",
    parameters: writeFileParameters,
  },
  async execute(input, context) {
    requireWritePermission(context, "write_file");

    const safePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    await mkdir(path.dirname(safePath.absolutePath), {recursive: true});
    await writeFile(safePath.absolutePath, input.content, "utf8");

    return okToolResult("Wrote file content.", {
      path: safePath.relativePath,
      bytesWritten: Buffer.byteLength(input.content, "utf8"),
    });
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
