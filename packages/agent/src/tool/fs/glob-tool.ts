import {readdir} from "node:fs/promises";
import path from "node:path";

import {ToolError} from "../tool-error.js";
import type {Tool} from "../types.js";
import {resolveWorkspacePath, toPosixPath} from "../../utils/path-safety.js";

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
]);

type GlobInput = {
  pattern?: unknown;
  maxResults?: unknown;
};

export const globTool: Tool<GlobInput, {paths: string[]}> = {
  definition: {
    name: "glob",
    description: "List files under the workspace, with basic pattern support reserved for future versions.",
    parameters: {
      type: "object",
      properties: {
        pattern: {
          type: "string",
          description: "Reserved glob pattern. The first version lists workspace files.",
        },
        maxResults: {
          type: "number",
          description: "Maximum number of paths to return.",
        },
      },
      additionalProperties: false,
    },
  },
  async execute(input, context) {
    if (
      input?.pattern !== undefined &&
      typeof input.pattern !== "string"
    ) {
      throw new ToolError({
        code: "TOOL_INVALID_INPUT",
        message: "glob pattern must be a string when provided.",
        toolName: "glob",
      });
    }

    const maxResults =
      typeof input?.maxResults === "number" && input.maxResults > 0
        ? Math.floor(input.maxResults)
        : 1000;
    const paths = await listWorkspaceFiles(context.workspaceRoot, maxResults);

    return {paths};
  },
};

export async function listWorkspaceFiles(
  workspaceRoot: string,
  maxResults = 1000,
): Promise<string[]> {
  const root = resolveWorkspacePath(workspaceRoot, ".");
  const paths: string[] = [];

  await walkDirectory(root.absolutePath, root.absolutePath, paths, maxResults);

  return paths;
}

async function walkDirectory(
  workspaceRoot: string,
  currentDirectory: string,
  paths: string[],
  maxResults: number,
): Promise<void> {
  if (paths.length >= maxResults) {
    return;
  }

  const entries = await readdir(currentDirectory, {withFileTypes: true});

  for (const entry of entries) {
    if (paths.length >= maxResults) {
      return;
    }

    if (entry.isDirectory() && DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(workspaceRoot, absolutePath, paths, maxResults);
      continue;
    }

    if (entry.isFile()) {
      paths.push(toPosixPath(path.relative(workspaceRoot, absolutePath)));
    }
  }
}
