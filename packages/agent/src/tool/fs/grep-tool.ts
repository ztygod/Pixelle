import {readFile} from "node:fs/promises";
import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";
import {resolveWorkspacePath} from "../../utils/path-safety.js";
import {listWorkspaceFiles} from "./glob-tool.js";

type GrepMatch = {
  path: string;
  line: number;
  text: string;
};

const grepParameters = z.object({
  reason: z
    .string()
    .describe(
      "Explain why you are calling this tool and what you expect to learn or change.",
    ),
  pattern: z
    .string()
    .min(1)
    .describe(
      "Literal text to search for inside workspace files. Use glob instead when you only need to find files by name or path.",
    ),
  maxResults: z
    .number()
    .positive()
    .optional()
    .describe("Maximum number of content matches to return."),
});

export const grepTool: Tool<typeof grepParameters, {matches: GrepMatch[]}> = {
  definition: {
    name: "grep",
    description:
      "Search file contents inside workspaceRoot for literal text. Use this when you need to find where code, config, or prose appears in files. Do not use this to find files by filename or path; use glob for that. Returns matching workspace-relative file paths, line numbers, and matching line text, with results capped to avoid large context.",
    parameters: grepParameters,
  },
  async execute(input, context) {
    requireReadPermission(context, "grep");

    const maxResults =
      typeof input.maxResults === "number" && input.maxResults > 0
        ? Math.floor(input.maxResults)
        : 100;
    const files = await listWorkspaceFiles(context.workspaceRoot, 5000);
    const matches: GrepMatch[] = [];

    for (const file of files) {
      if (matches.length >= maxResults) {
        break;
      }

      const safePath = resolveWorkspacePath(context.workspaceRoot, file);
      const content = await readTextFileIfSearchable(safePath.absolutePath);

      if (content === undefined) {
        continue;
      }

      const lines = content.split(/\r?\n/);

      for (const [index, text] of lines.entries()) {
        if (text.includes(input.pattern)) {
          matches.push({
            path: safePath.relativePath,
            line: index + 1,
            text,
          });
        }

        if (matches.length >= maxResults) {
          break;
        }
      }
    }

    return okToolResult("Searched workspace file contents.", {matches});
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

async function readTextFileIfSearchable(
  absolutePath: string,
): Promise<string | undefined> {
  try {
    const buffer = await readFile(absolutePath);

    // NUL bytes are a cheap signal that a file is binary and should be skipped.
    if (buffer.includes(0)) {
      return undefined;
    }

    return buffer.toString("utf8");
  } catch {
    return undefined;
  }
}
