import {mkdir, writeFile} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";
import {resolveWorkspacePath} from "../../workspace/path-safety.js";

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

/** Tool that writes complete UTF-8 file contents inside the workspace. */
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
    throwIfAborted(context, "write_file");

    if (context.fileWriter) {
      throwIfAborted(context, "write_file");
      const result = await context.fileWriter.writeFile(input.path, input.content);

      return okToolResult("Wrote file content.", result, {
        kind: "file",
        title: result.path,
        target: result.path,
        summary: `wrote ${formatBytes(result.bytesWritten)}`,
        stats: {
          bytesWritten: result.bytesWritten,
        },
      });
    }

    const safePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    throwIfAborted(context, "write_file");
    await mkdir(path.dirname(safePath.absolutePath), {recursive: true});
    throwIfAborted(context, "write_file");
    await writeFile(safePath.absolutePath, input.content, "utf8");

    const bytesWritten = Buffer.byteLength(input.content, "utf8");

    return okToolResult(
      "Wrote file content.",
      {
        path: safePath.relativePath,
        bytesWritten,
      },
      {
        kind: "file",
        title: safePath.relativePath,
        target: safePath.relativePath,
        summary: `wrote ${formatBytes(bytesWritten)}`,
        stats: {
          bytesWritten,
        },
      },
    );
  },
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Ensures this run granted write access to workspace files. */
function requireWritePermission(context: ToolContext, toolName: string): void {
  if (!context.permissions?.writeFile) {
    throw new ToolError({
      code: "TOOL_PERMISSION_DENIED",
      message: "File write permission is required.",
      toolName,
    });
  }
}

/** Throws a structured tool error when the run was cancelled. */
function throwIfAborted(context: ToolContext, toolName: string): void {
  if (context.signal?.aborted) {
    throw new ToolError({
      code: "TOOL_ABORTED",
      message: "Tool execution was aborted.",
      toolName,
    });
  }
}
