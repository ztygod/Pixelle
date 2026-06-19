import {readFile} from "node:fs/promises";
import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";
import {resolveWorkspacePath} from "../../workspace/path-safety.js";

const readFileParameters = z.object({
  reason: z
    .string()
    .describe(
      "Explain why you are calling this tool and what you expect to learn or change.",
    ),
  path: z
    .string()
    .min(1)
    .describe(
      "Workspace-relative path of the known file to read. Use glob to discover paths first, or grep to search file contents first.",
    ),
});

/** Tool that reads a known UTF-8 file inside the workspace. */
export const readFileTool: Tool<
  typeof readFileParameters,
  {path: string; content: string}
> = {
  definition: {
    name: "read_file",
    description:
      "Read the UTF-8 contents of a specific file inside workspaceRoot when you already know the exact relative path. Do not use this to explore the whole project; use glob first to find candidate paths. Do not use this to search text across files; use grep for content search. Returns the normalized workspace-relative path and full file content.",
    parameters: readFileParameters,
  },
  async execute(input, context) {
    requireReadPermission(context, "read_file");
    throwIfAborted(context, "read_file");

    const safePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    throwIfAborted(context, "read_file");
    const content = await readFile(safePath.absolutePath, "utf8");
    const lineCount = countLines(content);

    return okToolResult(
      "Read file content.",
      {
        path: safePath.relativePath,
        content,
      },
      {
        title: safePath.relativePath,
        summary: `${lineCount} ${lineCount === 1 ? "line" : "lines"} · ${formatBytes(Buffer.byteLength(content, "utf8"))}`,
        stats: {
          lines: lineCount,
          bytes: Buffer.byteLength(content, "utf8"),
        },
      },
    );
  },
};

function countLines(content: string): number {
  if (!content) {
    return 0;
  }

  return content.split(/\r?\n/).length;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

/** Ensures this run granted read access to workspace files. */
function requireReadPermission(context: ToolContext, toolName: string): void {
  if (!context.permissions?.readFile) {
    throw new ToolError({
      code: "TOOL_PERMISSION_DENIED",
      message: "File read permission is required.",
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
