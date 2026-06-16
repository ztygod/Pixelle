import {readFile} from "node:fs/promises";
import {z} from "zod";

import {resolveWorkspacePath} from "../../workspace/path-safety.js";
import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";

const editFileParameters = z.object({
  reason: z
    .string()
    .describe("Explain why this edit is needed and what behavior it changes."),
  path: z.string().min(1).describe("Workspace-relative path of the UTF-8 file to edit."),
  oldText: z
    .string()
    .min(1)
    .describe("Exact text to replace. Read the file first so this is precise."),
  newText: z.string().describe("Replacement text."),
  replaceAll: z
    .boolean()
    .optional()
    .describe("Replace every occurrence. Defaults to false and requires one match."),
});

/** Tool that performs exact-text replacements in an existing UTF-8 workspace file. */
export const editFileTool: Tool<
  typeof editFileParameters,
  {path: string; replacements: number; bytesWritten: number}
> = {
  definition: {
    name: "edit_file",
    description:
      "Edit an existing UTF-8 file by replacing exact text inside workspaceRoot. Use this for focused code changes after read_file. By default the oldText must appear exactly once; set replaceAll only when every occurrence should change. Returns the normalized path, replacement count, and bytes written.",
    parameters: editFileParameters,
  },
  async execute(input, context) {
    requireWritePermission(context, "edit_file");
    throwIfAborted(context, "edit_file");

    const safePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    throwIfAborted(context, "edit_file");
    const current = await readFile(safePath.absolutePath, "utf8");
    const count = countOccurrences(current, input.oldText);

    if (!input.replaceAll && count !== 1) {
      throw new ToolError({
        code: "TOOL_INVALID_INPUT",
        message:
          count === 0
            ? "The target text was not found."
            : "The target text is ambiguous. Set replaceAll or provide a more specific oldText.",
        toolName: "edit_file",
        details: {path: safePath.relativePath, matches: count},
      });
    }

    if (input.replaceAll && count === 0) {
      throw new ToolError({
        code: "TOOL_INVALID_INPUT",
        message: "The target text was not found.",
        toolName: "edit_file",
        details: {path: safePath.relativePath},
      });
    }

    const next = input.replaceAll
      ? current.split(input.oldText).join(input.newText)
      : current.replace(input.oldText, input.newText);
    throwIfAborted(context, "edit_file");
    const written = context.fileWriter
      ? await context.fileWriter.writeFile(safePath.relativePath, next)
      : await fallbackWrite(context, safePath.relativePath, next);

    return okToolResult("Edited file content.", {
      path: written.path,
      replacements: input.replaceAll ? count : 1,
      bytesWritten: written.bytesWritten,
    });
  },
};

/** Writes edited content through the regular write_file tool when no fileWriter exists. */
async function fallbackWrite(
  context: ToolContext,
  relativePath: string,
  content: string,
): Promise<{path: string; bytesWritten: number}> {
  const {writeFileTool} = await import("./write-file.tool.js");
  const result = await writeFileTool.execute(
    {reason: "Write edited file content.", path: relativePath, content},
    context,
  );

  if (!result.ok) {
    throw new ToolError({
      code: "TOOL_EXECUTION_FAILED",
      message: result.message,
      toolName: "edit_file",
      details: {code: result.code, data: result.data},
    });
  }

  return result.data;
}

/** Counts exact, non-overlapping occurrences of a search string. */
function countOccurrences(text: string, search: string): number {
  return text.split(search).length - 1;
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
