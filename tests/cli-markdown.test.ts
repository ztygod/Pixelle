import {describe, expect, it} from "vitest";

import {parseMarkdown} from "../src/cli/utils/markdown.js";

describe("parseMarkdown", () => {
  it("parses common CLI markdown blocks", () => {
    expect(
      parseMarkdown(
        [
          "## Summary",
          "",
          "- **Done** item",
          "- `code` item",
          "",
          "---",
          "",
          "```ts",
          "const value = 1;",
          "```",
        ].join("\n"),
      ),
    ).toMatchObject([
      {type: "heading", level: 2, text: "Summary"},
      {type: "list", ordered: false, items: ["**Done** item", "`code` item"]},
      {type: "hr"},
      {type: "code", language: "ts", code: "const value = 1;", closed: true},
    ]);
  });

  it("downgrades markdown tables to table rows", () => {
    expect(
      parseMarkdown(["| Name | Value |", "| --- | --- |", "| model | gpt |"].join("\n")),
    ).toMatchObject([
      {
        type: "table",
        rows: [
          ["Name", "Value"],
          ["model", "gpt"],
        ],
      },
    ]);
  });

  it("marks unfinished code fences while streaming", () => {
    expect(parseMarkdown("```ts\nconst value = 1;")).toMatchObject([
      {type: "code", language: "ts", code: "const value = 1;", closed: false},
    ]);
  });
});
