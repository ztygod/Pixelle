import {readFile} from "node:fs/promises";
import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";
import {resolveWorkspacePath} from "../../workspace/path-safety.js";
import {listWorkspaceFiles} from "./glob-tool.js";
import {createIgnoredDirectoryArgs, isRgAvailable, runRg} from "./rg.js";

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

/** Tool that searches workspace file contents for literal text matches. */
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
    // rg handles the common case; the Node scanner preserves behavior when rg is absent.
    const matches =
      (await searchWorkspaceWithRg(
        context.workspaceRoot,
        input.pattern,
        maxResults,
        context.signal,
      )) ??
      (await searchWorkspaceWithNode(
        context.workspaceRoot,
        input.pattern,
        maxResults,
        context.signal,
      ));

    return okToolResult("Searched workspace file contents.", {matches});
  },
};

/** Searches with ripgrep and returns undefined when the Node fallback should run. */
async function searchWorkspaceWithRg(
  workspaceRoot: string,
  pattern: string,
  maxResults: number,
  signal: AbortSignal | undefined,
): Promise<GrepMatch[] | undefined> {
  if (!(await isRgAvailable(workspaceRoot))) {
    return undefined;
  }

  try {
    const result = await runRg(
      [
        "--fixed-strings",
        "--line-number",
        "--no-heading",
        "--color",
        "never",
        "--hidden",
        "--no-ignore",
        ...createIgnoredDirectoryArgs(),
        "--",
        pattern,
      ],
      {
        cwd: workspaceRoot,
        signal,
      },
    );

    // rg exits with 1 for "no matches", which is a successful empty result.
    if (result.timedOut || (result.exitCode !== 0 && result.exitCode !== 1)) {
      return undefined;
    }

    return parseRgMatches(result.stdout, maxResults);
  } catch {
    return undefined;
  }
}

/** Searches readable text files using Node when ripgrep is unavailable or fails. */
async function searchWorkspaceWithNode(
  workspaceRoot: string,
  pattern: string,
  maxResults: number,
  signal: AbortSignal | undefined,
): Promise<GrepMatch[]> {
  throwIfAborted(signal);
  const files = await listWorkspaceFiles(workspaceRoot, 5000, undefined, signal);
  const matches: GrepMatch[] = [];

  for (const file of files) {
    throwIfAborted(signal);

    if (matches.length >= maxResults) {
      break;
    }

    const safePath = resolveWorkspacePath(workspaceRoot, file);
    const content = await readTextFileIfSearchable(safePath.absolutePath);

    if (content === undefined) {
      continue;
    }

    const lines = content.split(/\r?\n/);

    for (const [index, text] of lines.entries()) {
      throwIfAborted(signal);

      if (text.includes(pattern)) {
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

  return matches;
}

/** Parses ripgrep no-heading output into capped structured match objects. */
function parseRgMatches(stdout: string, maxResults: number): GrepMatch[] {
  const matches: GrepMatch[] = [];

  for (const line of stdout.split(/\r?\n/)) {
    if (!line) {
      continue;
    }

    // Parse `path:line:text`; the final capture keeps additional colons in the text.
    const match = /^(.*?):(\d+):(.*)$/.exec(line);

    if (!match) {
      continue;
    }

    matches.push({
      path: match[1].replaceAll("\\", "/"),
      line: Number(match[2]),
      text: match[3],
    });

    if (matches.length >= maxResults) {
      break;
    }
  }

  return matches;
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
function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new ToolError({
      code: "TOOL_ABORTED",
      message: "Tool execution was aborted.",
      toolName: "grep",
    });
  }
}

/** Reads a file as UTF-8 text unless it appears to be binary or unreadable. */
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
