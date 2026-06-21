import {describe, expect, it} from "vitest";

import {
  buildRuntimeContext,
  ContextEngine,
  ContextRegistry,
  DefaultContextBudgetPolicy,
  NoopContextCompressor,
} from "../src/context/index.js";

describe("buildRuntimeContext", () => {
  it("matches the default ContextEngine output", () => {
    const input = {
      systemPrompt: "Base.",
      outputInstructions: "Use Markdown.",
      sections: [{title: "Runtime", content: "details"}],
      tokenLimit: 100,
    };

    expect(buildRuntimeContext(input)).toEqual(new ContextEngine().build(input));
  });

  it("sorts context sections by descending priority", () => {
    const result = new ContextEngine().build({
      systemPrompt: "Base.",
      sections: [
        {id: "low", content: "low", priority: 1},
        {id: "high", content: "high", priority: 10},
        {id: "default", content: "default"},
      ],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("high\n\nlow\n\ndefault");
    expect(result.includedSections.map((section) => section.id)).toEqual([
      "high",
      "low",
      "default",
    ]);
  });

  it("uses source priority when explicit priority is absent", () => {
    const result = new ContextEngine().build({
      systemPrompt: "Base.",
      sections: [
        {id: "file", content: "file", source: {kind: "file"}},
        {id: "workspace", content: "workspace", source: {kind: "workspace"}},
        {id: "memory", content: "memory", source: {kind: "memory"}},
      ],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("workspace\n\nmemory\n\nfile");
  });

  it("skips empty section content", () => {
    const result = buildRuntimeContext({
      systemPrompt: "Base.",
      sections: [
        {id: "empty", title: "Empty", content: "   ", priority: 100},
        {id: "filled", content: "filled"},
      ],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("filled");
    expect(result.includedSections.map((section) => section.id)).toEqual(["filled"]);
    expect(result.sectionUsages.map((usage) => usage.section.id)).toEqual(["filled"]);
    expect(result.droppedSections).toEqual([]);
  });

  it("formats titled sections with markdown headings", () => {
    const result = buildRuntimeContext({
      systemPrompt: "Base.",
      sections: [{title: "Notes", content: "  keep this  "}],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("## Notes\nkeep this");
  });

  it("uses the existing 35 percent runtime context budget policy", () => {
    expect(
      new DefaultContextBudgetPolicy().createBudget({
        sections: [],
        tokenLimit: 100,
      }),
    ).toEqual({
      tokenLimit: 100,
      runtimeContextRatio: 0.35,
      maxContextChars: 140,
    });
  });

  it("truncates over-budget runtime context and records included, partial, and dropped sections", () => {
    const result = buildRuntimeContext({
      systemPrompt: "Base.",
      sections: [
        {id: "first", content: "abcdefghij", priority: 10},
        {id: "second", content: "klmnopqrst", priority: 9},
      ],
      tokenLimit: 3,
    });

    expect(result.contextText).toBe("abcd");
    expect(result.includedSections).toEqual([]);
    expect(result.partialSections.map((section) => section.id)).toEqual(["first"]);
    expect(result.droppedSections.map((section) => section.id)).toEqual([
      "first",
      "second",
    ]);
    expect(result.sectionUsages.map((usage) => usage.status)).toEqual([
      "partial",
      "dropped",
    ]);
    expect(result.tokenEstimate).toBe(1);
  });

  it("keeps fully injected sections separate from partial and dropped sections", () => {
    const result = buildRuntimeContext({
      systemPrompt: "Base.",
      sections: [
        {id: "first", content: "abc", priority: 10},
        {id: "second", content: "defghij", priority: 9},
        {id: "third", content: "klm", priority: 8},
      ],
      tokenLimit: 5,
    });

    expect(result.contextText).toBe("abc\n\nde");
    expect(result.includedSections.map((section) => section.id)).toEqual(["first"]);
    expect(result.partialSections.map((section) => section.id)).toEqual(["second"]);
    expect(result.droppedSections.map((section) => section.id)).toEqual([
      "second",
      "third",
    ]);
    expect(result.sectionUsages).toEqual([
      expect.objectContaining({
        section: expect.objectContaining({id: "first"}),
        status: "included",
      }),
      expect.objectContaining({
        section: expect.objectContaining({id: "second"}),
        status: "partial",
      }),
      expect.objectContaining({
        section: expect.objectContaining({id: "third"}),
        status: "dropped",
      }),
    ]);
  });

  it("builds system prompt with output instructions and runtime context", () => {
    const result = buildRuntimeContext({
      systemPrompt: "Base prompt.",
      outputInstructions: "Use Markdown.",
      sections: [{title: "Runtime", content: "details"}],
      tokenLimit: 100,
    });

    expect(result.systemPrompt).toBe(
      "Base prompt.\n\nUse Markdown.\n\n# Runtime Context\n## Runtime\ndetails",
    );
  });

  it("dedupes sections by replaceKey or id with the later section winning", () => {
    const registry = new ContextRegistry()
      .addMany([
        {id: "same", content: "old"},
        {id: "same", content: "new"},
        {replaceKey: "profile", content: "old profile"},
        {replaceKey: "profile", content: "new profile"},
        {content: "kept"},
      ])
      .normalize()
      .dedupe();

    expect(registry.getAll().map((section) => section.content)).toEqual([
      "new",
      "new profile",
      "kept",
    ]);
  });

  it("does not alter ordinary sections with the default compressor", () => {
    const section = {
      id: "plain",
      title: "Plain",
      content: "content",
      source: {kind: "user" as const},
    };
    const result = new NoopContextCompressor().compress(
      section,
      new DefaultContextBudgetPolicy().createBudget({
        sections: [section],
        tokenLimit: 100,
      }),
    );

    expect(result).toEqual({section, compressed: false});
  });
});
