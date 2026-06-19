import {readdir} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

import {okToolResult} from "../tool-result.js";
import type {Tool} from "../types.js";
import {resolveWorkspacePath, toPosixPath} from "../../workspace/path-safety.js";
import {
  createIgnoredDirectoryArgs,
  isRgAvailable,
  parseRgFileLines,
  runRg,
} from "./rg.js";

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

/** Tool that lists workspace-relative file paths using rg or a Node fallback walker. */
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
    const paths = await listWorkspaceFiles(
      context.workspaceRoot,
      maxResults,
      input.pattern,
      context.signal,
    );

    return okToolResult(
      "Listed workspace files.",
      {paths},
      {
        kind: "list",
        title: input.pattern ?? "workspace files",
        target: input.pattern ?? "workspace files",
        summary: `${paths.length} ${paths.length === 1 ? "file" : "files"}`,
        preview: paths.slice(0, 20).join("\n"),
        stats: {
          files: paths.length,
        },
        truncated: paths.length >= maxResults,
      },
    );
  },
};

/** Lists workspace files with common generated directories ignored. */
export async function listWorkspaceFiles(
  workspaceRoot: string,
  maxResults = 1000,
  pattern?: string,
  signal?: AbortSignal,
): Promise<string[]> {
  // Prefer rg for fast path listing, but keep the Node walker as a portability fallback.
  const rgPaths = await listWorkspaceFilesWithRg(
    workspaceRoot,
    maxResults,
    pattern,
    signal,
  );

  if (rgPaths) {
    return rgPaths;
  }

  return listWorkspaceFilesWithNode(workspaceRoot, maxResults, pattern, signal);
}

/** Uses ripgrep to list files quickly when rg is available and succeeds. */
async function listWorkspaceFilesWithRg(
  workspaceRoot: string,
  maxResults: number,
  pattern: string | undefined,
  signal: AbortSignal | undefined,
): Promise<string[] | undefined> {
  if (!(await isRgAvailable(workspaceRoot))) {
    return undefined;
  }

  try {
    const result = await runRg(
      ["--files", "--hidden", "--no-ignore", ...createIgnoredDirectoryArgs()],
      {
        cwd: workspaceRoot,
        signal,
      },
    );

    // Any rg failure falls back to the Node implementation instead of failing the tool.
    if (result.exitCode !== 0 || result.timedOut) {
      return undefined;
    }

    return filterPathResults(parseRgFileLines(result.stdout), maxResults, pattern);
  } catch {
    return undefined;
  }
}

/** Lists workspace files by recursively walking directories in Node. */
async function listWorkspaceFilesWithNode(
  workspaceRoot: string,
  maxResults: number,
  pattern: string | undefined,
  signal: AbortSignal | undefined,
): Promise<string[]> {
  throwIfAborted(signal);
  const root = resolveWorkspacePath(workspaceRoot, ".");
  const paths: string[] = [];

  await walkDirectory(
    root.absolutePath,
    root.absolutePath,
    paths,
    maxResults,
    pattern,
    signal,
  );

  return paths;
}

/** Recursively walks a directory tree while respecting max result and abort limits. */
async function walkDirectory(
  workspaceRoot: string,
  currentDirectory: string,
  paths: string[],
  maxResults: number,
  pattern: string | undefined,
  signal: AbortSignal | undefined,
): Promise<void> {
  throwIfAborted(signal);

  if (paths.length >= maxResults) {
    return;
  }

  const entries = await readdir(currentDirectory, {withFileTypes: true});

  for (const entry of entries) {
    throwIfAborted(signal);

    if (paths.length >= maxResults) {
      return;
    }

    if (entry.isDirectory() && DEFAULT_IGNORED_DIRECTORIES.has(entry.name)) {
      continue;
    }

    const absolutePath = path.join(currentDirectory, entry.name);

    if (entry.isDirectory()) {
      await walkDirectory(
        workspaceRoot,
        absolutePath,
        paths,
        maxResults,
        pattern,
        signal,
      );
      continue;
    }

    if (entry.isFile()) {
      const relativePath = toPosixPath(path.relative(workspaceRoot, absolutePath));

      if (!pattern || relativePath.includes(pattern)) {
        paths.push(relativePath);
      }
    }
  }
}

/** Applies simple substring filtering and result capping to discovered paths. */
function filterPathResults(
  paths: readonly string[],
  maxResults: number,
  pattern: string | undefined,
): string[] {
  // The first version treats pattern as a simple path substring, not full glob syntax.
  const filteredPaths = pattern
    ? paths.filter((filePath) => filePath.includes(pattern))
    : paths;

  return filteredPaths.slice(0, maxResults);
}

/** Throws a standard abort-style error so ToolRunner can normalize cancellation. */
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    const error = new Error("Tool execution was aborted.");
    error.name = "AbortError";
    throw error;
  }
}
