import {describe, expect, it} from "vitest";

import {
  countDiffLines,
  createFileChangeViewModel,
  createFileDiff,
} from "../src/cli/utils/diff.js";

describe("createFileDiff", () => {
  it("creates a readable diff for modified files", () => {
    const diff = createFileDiff({
      path: "src/app.ts",
      status: "modified",
      beforeContent: "const value = 1;\n",
      afterContent: "const value = 2;\n",
    });

    expect(diff).toContain("--- src/app.ts (before)");
    expect(diff).toContain("+++ src/app.ts (after)");
    expect(diff).toContain("-const value = 1;");
    expect(diff).toContain("+const value = 2;");
  });

  it("returns undefined when content did not change", () => {
    expect(
      createFileDiff({
        path: "src/app.ts",
        status: "modified",
        beforeContent: "same\n",
        afterContent: "same\n",
      }),
    ).toBeUndefined();
  });

  it("creates a file change view model with line counts", () => {
    expect(
      createFileChangeViewModel({
        path: "src/app.ts",
        status: "modified",
        beforeContent: "const value = 1;\n",
        afterContent: "const value = 2;\nconst next = 3;\n",
      }),
    ).toMatchObject({
      kind: "edited",
      filePath: "src/app.ts",
      addedLines: 2,
      removedLines: 1,
    });
  });

  it("counts diff lines without file headers", () => {
    expect(
      countDiffLines(
        [
          "--- src/app.ts (before)",
          "+++ src/app.ts (after)",
          "@@ -1 +1 @@",
          "-const value = 1;",
          "+const value = 2;",
        ].join("\n"),
      ),
    ).toEqual({addedLines: 1, removedLines: 1});
  });

  it("truncates large diffs with a clear notice", () => {
    const diff = createFileDiff(
      {
        path: "src/app.ts",
        status: "modified",
        beforeContent: Array.from({length: 20}, (_, index) => `old ${index}`).join("\n"),
        afterContent: Array.from({length: 20}, (_, index) => `new ${index}`).join("\n"),
      },
      {maxLines: 8},
    );

    expect(diff).toContain("... diff truncated, showing first 8 lines");
  });
});
