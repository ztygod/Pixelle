import {describe, expect, it} from "vitest";

import {
  formatGutter,
  getLineNumberWidth,
  normalizeCodeLanguage,
  splitCodeLines,
} from "../src/cli/components/markdown/CodeBlock.js";
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

  it("normalizes fenced code block languages", () => {
    expect(
      parseMarkdown("```TSX title=App\nexport function App() {}\n```"),
    ).toMatchObject([
      {
        type: "code",
        language: "tsx",
        code: "export function App() {}",
        closed: true,
      },
    ]);
  });

  it("parses diff fences", () => {
    expect(parseMarkdown("```diff\n-a\n+b\n```")).toMatchObject([
      {type: "code", language: "diff", code: "-a\n+b", closed: true},
    ]);
  });

  it("preserves code block indentation", () => {
    expect(
      parseMarkdown("```ts\n  const value = 1;\n    return value;\n```"),
    ).toMatchObject([
      {
        type: "code",
        language: "ts",
        code: "  const value = 1;\n    return value;",
        closed: true,
      },
    ]);
  });
});

describe("CodeBlock formatting helpers", () => {
  it("right-aligns line number gutters", () => {
    expect(getLineNumberWidth(9)).toBe(2);
    expect(getLineNumberWidth(120)).toBe(3);
    expect(formatGutter(1, 2, true)).toBe(" 1 │ ");
    expect(formatGutter(12, 2, true)).toBe("12 │ ");
    expect(formatGutter(120, 3, true)).toBe("120 │ ");
  });

  it("splits code lines without trimming indentation", () => {
    expect(splitCodeLines("  const value = 1;\n    return value;")).toEqual([
      "  const value = 1;",
      "    return value;",
    ]);
  });

  it("normalizes code languages without requiring a known language", () => {
    expect(normalizeCodeLanguage(" TS ")).toBe("ts");
    expect(normalizeCodeLanguage("unknown-lang")).toBe("unknown-lang");
    expect(normalizeCodeLanguage(undefined)).toBeUndefined();
  });
});
