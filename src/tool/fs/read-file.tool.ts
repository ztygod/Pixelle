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

    const safePath = resolveWorkspacePath(context.workspaceRoot, input.path);
    const content = await readFile(safePath.absolutePath, "utf8");

    return okToolResult("Read file content.", {
      path: safePath.relativePath,
      content,
    });
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
