import {readdir} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

import {okToolResult} from "../tool-result.js";
import type {Tool} from "../types.js";
import {resolveWorkspacePath, toPosixPath} from "../../utils/path-safety.js";

const DEFAULT_IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "coverage",
]);

const globParameters = z.object({
  reason: z
    .string()
    .describe(
      "Explain why you are calling this tool and what you expect to learn or change.",
    ),
  pattern: z
    .string()
    .optional()
    .describe(
      "Optional file path or filename pattern to locate candidate files. This first version reserves pattern support and still lists workspace files.",
    ),
  maxResults: z
    .number()
    .positive()
    .optional()
    .describe("Maximum number of workspace-relative file paths to return."),
});

export const globTool: Tool<typeof globParameters, {paths: string[]}> = {
  definition: {
    name: "glob",
    description:
      "Find files by path or filename inside workspaceRoot. Use this to explore project structure or locate candidate files before read_file or write_file. This does not search file contents; use grep when you need to find text inside files. Returns workspace-relative file paths and skips common generated directories.",
    parameters: globParameters,
  },
  async execute(input, context) {
    const maxResults =
      typeof input?.maxResults === "number" && input.maxResults > 0
        ? Math.floor(input.maxResults)
        : 1000;
    const paths = await listWorkspaceFiles(context.workspaceRoot, maxResults);

    return okToolResult("Listed workspace files.", {paths});
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
