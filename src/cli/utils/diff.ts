import {createTwoFilesPatch} from "diff";

import type {ChangedFileState} from "../types.js";

const MAX_DIFF_LINES = 120;

export type FileChangeKind = "created" | "edited" | "deleted" | "renamed";

export type FileChangeViewModel = {
  kind: FileChangeKind;
  filePath: string;
  oldPath?: string;
  addedLines?: number;
  removedLines?: number;
  diff?: string;
};

export function createFileDiff(
  file: ChangedFileState,
  options: {maxLines?: number} = {},
): string | undefined {
  const before = file.beforeContent ?? "";
  const after = file.afterContent ?? "";

  if (before === after) {
    return undefined;
  }

  const diff = createTwoFilesPatch(
    `${file.path} (before)`,
    `${file.path} (after)`,
    before,
    after,
    "",
    "",
    {context: 3},
  );

  return truncateDiff(diff, options.maxLines ?? MAX_DIFF_LINES);
}

export function createFileChangeViewModel(file: ChangedFileState): FileChangeViewModel {
  const diff = file.diff ?? createFileDiff(file);
  const countableDiff =
    file.diff ?? createFileDiff(file, {maxLines: Number.POSITIVE_INFINITY});
  const counts = countableDiff ? countDiffLines(countableDiff) : undefined;

  return {
    kind: getFileChangeKind(file.status),
    filePath: file.path,
    oldPath: file.oldPath,
    addedLines: file.addedLines ?? counts?.addedLines,
    removedLines: file.removedLines ?? counts?.removedLines,
    diff,
  };
}

export function countDiffLines(diff: string): {
  addedLines: number;
  removedLines: number;
} {
  return diff.split(/\r?\n/).reduce(
    (counts, line) => {
      if (line.startsWith("+") && !line.startsWith("+++")) {
        counts.addedLines += 1;
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        counts.removedLines += 1;
      }

      return counts;
    },
    {addedLines: 0, removedLines: 0},
  );
}

function getFileChangeKind(status: ChangedFileState["status"]): FileChangeKind {
  switch (status) {
    case "created":
      return "created";
    case "modified":
      return "edited";
    case "deleted":
      return "deleted";
  }
}

function truncateDiff(diff: string, maxLines: number): string {
  const lines = diff.trimEnd().split("\n");
  if (lines.length <= maxLines) {
    return lines.join("\n");
  }

  return [
    ...lines.slice(0, maxLines),
    `... diff truncated, showing first ${maxLines} lines`,
  ].join("\n");
}
