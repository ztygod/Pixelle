import {createTwoFilesPatch} from "diff";

import type {ChangedFileState} from "../types.js";

const MAX_DIFF_LINES = 80;

export function createFileDiff(file: ChangedFileState): string | undefined {
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

  return truncateDiff(diff);
}

function truncateDiff(diff: string): string {
  const lines = diff.trimEnd().split("\n");
  if (lines.length <= MAX_DIFF_LINES) {
    return lines.join("\n");
  }

  return [
    ...lines.slice(0, MAX_DIFF_LINES),
    `... truncated ${lines.length - MAX_DIFF_LINES} diff lines`,
  ].join("\n");
}
