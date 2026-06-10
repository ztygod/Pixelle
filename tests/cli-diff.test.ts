import {describe, expect, it} from "vitest";

import {createFileDiff} from "../src/cli/utils/diff.js";

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
});
