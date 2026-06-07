import {readFile} from "node:fs/promises";

import {ToolError} from "../tool-error.js";
import type {Tool, ToolContext} from "../types.js";
import {resolveWorkspacePath} from "../../utils/path-safety.js";
import {listWorkspaceFiles} from "./glob-tool.js";

type GrepInput = {
  pattern?: unknown;
  maxResults?: unknown;
};

type GrepMatch = {
  path: string;
  line: number;
  text: string;
};

export const grepTool: Tool<GrepInput, {matches: GrepMatch[]}> = {
  definition: {
    name: "grep",
    description: "Search text files inside the workspace for a literal pattern.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Literal text pattern to search for.",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of matches to return.",
        },
      },
      required: ["pattern"],
      additionalProperties: false,
    },
  },
  async execute(input, context) {
    requireReadPermission(context, "grep");

    if (typeof input?.pattern !== "string" || input.pattern.length === 0) {
      throw new ToolError({
        code: "TOOL_INVALID_INPUT",
        message: "grep requires a non-empty string pattern.",
        toolName: "grep",
      });
    }

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

    return {matches};
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
