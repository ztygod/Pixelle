import {describe, expect, it} from "vitest";

import {
  ApproxTokenEstimator,
  buildRuntimeContext,
  ContextCompressionPipeline,
  ContextCompressionResultFactory,
  ContextBudgetExceededError,
  ContextEngine,
  ContextRegistry,
  DefaultContextBudgetPolicy,
  estimateTokens,
  GptTokenEstimator,
  RuleBasedContextCompressor,
  truncateTextToTokens,
  type ContextBudget,
  type ContextBudgetPolicy,
  type ContextCompressionResult,
  type ContextCompressor,
  type ContextSection,
  type TokenEstimator,
} from "../src/context/index.js";

class CharTokenEstimator implements TokenEstimator {
  countText(text: string): number {
    return text.length;
  }
}

const charTokenEstimator = new CharTokenEstimator();

class ThrowingCompressor implements ContextCompressor {
  compress(): ContextCompressionResult {
    throw new Error("Compressor should not run.");
  }
}

class MarkingCompressor implements ContextCompressor {
  compress(section: ContextSection, _budget: ContextBudget): ContextCompressionResult {
    const compressedSection = {
      ...section,
      content: section.content.slice(
        0,
        Math.max(1, Math.floor(section.content.length / 2)),
      ),
    };

    return {
      section: compressedSection,
      originalSection: section,
      compressed: true,
      originalChars: section.content.length,
      compressedChars: compressedSection.content.length,
      originalTokens: section.content.length,
      compressedTokens: compressedSection.content.length,
      omittedChars: section.content.length - compressedSection.content.length,
      savedChars: section.content.length - compressedSection.content.length,
      savedTokens: section.content.length - compressedSection.content.length,
      compressionRatio: compressedSection.content.length / section.content.length,
      tokenCompressionRatio: compressedSection.content.length / section.content.length,
      reason: "Marked by test compressor.",
    };
  }
}

describe("buildRuntimeContext", () => {
  it("provides approximate and gpt-backed token estimators", () => {
    const approx = new ApproxTokenEstimator();
    const gpt = new GptTokenEstimator();

    expect(approx.countText("hello world")).toBeGreaterThan(0);
    expect(gpt.countText("hello world")).toBeGreaterThan(0);
    expect(estimateTokens("hello world")).toBeGreaterThan(0);
  });

  it("matches the default ContextEngine output", () => {
    const input = {
      baseSystemPrompt: "Base.",
      outputInstructions: "Use Markdown.",
      sections: [{title: "Runtime", content: "details"}],
      tokenLimit: 100,
    };

    expect(buildRuntimeContext(input)).toEqual(new ContextEngine().build(input));
  });

  it("sorts context sections by descending priority", () => {
    const result = new ContextEngine().build({
      baseSystemPrompt: "Base.",
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
      baseSystemPrompt: "Base.",
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
      baseSystemPrompt: "Base.",
      sections: [
        {id: "empty", title: "Empty", content: "   ", priority: 100},
        {id: "filled", content: "filled"},
      ],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("filled");
    expect(result.includedSections.map((section) => section.id)).toEqual(["filled"]);
    expect(result.sectionUsages.map((usage) => usage.section.id)).toEqual(["filled"]);
    expect(result.omittedSections).toEqual([]);
  });

  it("formats titled sections with markdown headings", () => {
    const result = buildRuntimeContext({
      baseSystemPrompt: "Base.",
      sections: [{title: "Notes", content: "  keep this  "}],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("## Notes\nkeep this");
  });

  it("builds a token-first runtime context budget policy", () => {
    expect(
      new DefaultContextBudgetPolicy().createBudget({
        sections: [],
        tokenLimit: 100,
      }),
    ).toMatchObject({
      tokenLimit: 100,
      modelContextWindow: 100,
      reservedOutputTokens: 20,
      runtimeContextTokens: 80,
      systemPromptTokens: 0,
      outputInstructionTokens: 0,
      toolSchemaTokens: 0,
      conversationTokens: 0,
      safetyMarginTokens: 0,
    });
  });

  it("deducts prompt, conversation, tool schema, and safety tokens from runtime context budget", () => {
    const budget = new DefaultContextBudgetPolicy({
      reservedOutputTokens: 10,
    }).createBudget(
      {
        baseSystemPrompt: "system",
        outputInstructions: "output",
        sections: [],
        tokenLimit: 100,
        conversationMessages: [{role: "user", content: "conversation"}],
        toolSchemas: [{name: "tool"}],
        safetyMarginTokens: 3,
      },
      charTokenEstimator,
    );

    expect(budget).toMatchObject({
      modelContextWindow: 100,
      reservedOutputTokens: 10,
      systemPromptTokens: 6,
      outputInstructionTokens: 6,
      conversationTokens: 17,
      toolSchemaTokens: 17,
      safetyMarginTokens: 3,
      runtimeContextTokens: 41,
    });
  });

  it("truncates over-budget runtime context and records included, partial, and omitted sections", () => {
    const result = new ContextEngine({
      budgetPolicy: fixedRuntimeBudgetPolicy(4),
      tokenEstimator: charTokenEstimator,
    }).build({
      baseSystemPrompt: "Base.",
      sections: [
        {id: "first", content: "abcdefghij", priority: 10},
        {id: "second", content: "klmnopqrst", priority: 9},
      ],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("abcd");
    expect(result.includedSections).toEqual([]);
    expect(result.partiallyIncludedSections.map((section) => section.id)).toEqual([
      "first",
    ]);
    expect(result.omittedSections.map((section) => section.id)).toEqual(["second"]);
    expect(result.sectionUsages.map((usage) => usage.status)).toEqual([
      "partial",
      "omitted",
    ]);
    expect(result.diagnostics?.contextTextTokens).toBe(4);
    expect(result.tokenEstimate).toBe(
      charTokenEstimator.countText(result.assembledSystemPrompt),
    );
  });

  it("keeps fully injected sections separate from partial and omitted sections", () => {
    const result = new ContextEngine({
      budgetPolicy: fixedRuntimeBudgetPolicy(7),
      tokenEstimator: charTokenEstimator,
    }).build({
      baseSystemPrompt: "Base.",
      sections: [
        {id: "first", content: "abc", priority: 10},
        {id: "second", content: "defghij", priority: 9},
        {id: "third", content: "klm", priority: 8},
      ],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("abc\n\nde");
    expect(result.includedSections.map((section) => section.id)).toEqual(["first"]);
    expect(result.partiallyIncludedSections.map((section) => section.id)).toEqual([
      "second",
    ]);
    expect(result.omittedSections.map((section) => section.id)).toEqual(["third"]);
    expect(result.sectionUsages).toEqual([
      expect.objectContaining({
        section: expect.objectContaining({id: "first"}),
        status: "included",
        reason: "Section fits within the remaining context budget.",
      }),
      expect.objectContaining({
        section: expect.objectContaining({id: "second"}),
        status: "partial",
        reason:
          "Section exceeded the remaining context budget and was partially included.",
      }),
      expect.objectContaining({
        section: expect.objectContaining({id: "third"}),
        status: "omitted",
        reason: "No remaining context budget for this section.",
      }),
    ]);
  });

  it("builds system prompt with output instructions and runtime context", () => {
    const result = buildRuntimeContext({
      baseSystemPrompt: "Base prompt.",
      outputInstructions: "Use Markdown.",
      sections: [{title: "Runtime", content: "details"}],
      tokenLimit: 100,
    });

    expect(result.assembledSystemPrompt).toBe(
      "Base prompt.\n\nUse Markdown.\n\n# Runtime Context\n## Runtime\ndetails",
    );
  });

  it("throws when protected required context makes the final prompt exceed the model window", () => {
    expect(() =>
      new ContextEngine({
        budgetPolicy: fixedRuntimeBudgetPolicy(0),
        tokenEstimator: charTokenEstimator,
      }).build({
        baseSystemPrompt: "Base.",
        sections: [
          {
            id: "required",
            content: "required content",
            required: true,
            truncation: "none",
          },
        ],
        tokenLimit: 20,
      }),
    ).toThrow(ContextBudgetExceededError);
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

  it("does not trigger compression below the configured threshold", () => {
    const compressor = new ThrowingCompressor();
    const pipeline = new ContextCompressionPipeline({
      compressor,
      thresholdRatio: 0.85,
      tokenEstimator: charTokenEstimator,
    });
    const compression = pipeline.compress(
      [{id: "short", content: "short"}],
      new DefaultContextBudgetPolicy().createBudget({
        sections: [],
        tokenLimit: 100,
      }),
    );
    const result = new ContextEngine({
      compressionPipeline: pipeline,
    }).build({
      baseSystemPrompt: "Base.",
      sections: [{id: "short", content: "short"}],
      tokenLimit: 100,
    });

    expect(compression).toMatchObject({
      estimatedContextChars: 5,
      estimatedContextTokens: 5,
      compressionLimitTokens: 68,
      thresholdRatio: 0.85,
      triggered: false,
    });
    expect(compression.sections).toEqual([{id: "short", content: "short"}]);
    expect(compression.results).toEqual([
      expect.objectContaining({
        compressed: false,
        reason:
          "Compression was not triggered because runtime context is below the configured total threshold.",
      }),
    ]);
    expect(result.diagnostics).toMatchObject({
      compressionThresholdRatio: 0.85,
      compressionTriggered: false,
      estimatedContextChars: 5,
      estimatedContextTokens: 5,
      compressionLimitTokens: 66,
    });
    expect(result.diagnostics?.compressionResults).toEqual([
      expect.objectContaining({
        section: expect.objectContaining({id: "short"}),
        compressed: false,
        originalChars: 5,
        compressedChars: 5,
        reason:
          "Compression was not triggered because runtime context is below the configured total threshold.",
      }),
    ]);
  });

  it("skips compression for sections that are protected or below strategy thresholds", () => {
    const pipeline = new ContextCompressionPipeline({
      compressor: new ThrowingCompressor(),
      thresholdRatio: 0,
      minSectionTokens: 10,
      tokenEstimator: charTokenEstimator,
    });
    const sections: ContextSection[] = [
      {
        id: "required",
        content: "required long content",
        required: true,
        truncation: "none",
        source: {kind: "tool"},
      },
      {
        id: "opt-out",
        content: "opt out long content",
        compressible: false,
        source: {kind: "tool"},
      },
      {
        id: "short",
        content: "short",
        source: {kind: "file"},
      },
    ];

    const compression = pipeline.compress(sections, rawBudget(100));

    expect(compression.results.map((result) => result.reason)).toEqual([
      "Required section disallows truncation and is protected from compression.",
      "Section opted out of compression.",
      "Section is below the minimum compression threshold (5 < 10 tokens).",
    ]);
  });

  it("triggers compression above the configured threshold and exposes diagnostics", () => {
    const pipeline = new ContextCompressionPipeline({
      compressor: new MarkingCompressor(),
      thresholdRatio: 0.5,
      minSectionTokens: 1,
      tokenEstimator: charTokenEstimator,
    });
    const result = new ContextEngine({
      compressionPipeline: pipeline,
      budgetPolicy: new DefaultContextBudgetPolicy({reservedOutputTokens: 0}),
      tokenEstimator: charTokenEstimator,
    }).build({
      baseSystemPrompt: "Base prompt.",
      outputInstructions: "Use Markdown.",
      sections: [{id: "long", content: "abcdefghijklmnop", source: {kind: "tool"}}],
      tokenLimit: 55,
    });

    expect(result.contextText).toBe("abcdefgh");
    expect(result.tokenEstimate).toBe(
      charTokenEstimator.countText(result.assembledSystemPrompt),
    );
    expect(result.diagnostics).toMatchObject({
      budget: {
        tokenLimit: 55,
        modelContextWindow: 55,
        reservedOutputTokens: 0,
        runtimeContextTokens: 30,
      },
      estimatedContextChars: 16,
      estimatedContextTokens: 16,
      compressionThresholdRatio: 0.5,
      compressionTriggered: true,
      compressionLimitTokens: 15,
      contextTextTokens: charTokenEstimator.countText(result.contextText),
      systemPromptTokens: charTokenEstimator.countText(result.assembledSystemPrompt),
    });
    expect(result.diagnostics?.compressionResults).toEqual([
      expect.objectContaining({
        originalSection: expect.objectContaining({id: "long"}),
        section: expect.objectContaining({id: "long", content: "abcdefgh"}),
        compressed: true,
        originalChars: 16,
        compressedChars: 8,
        originalTokens: 16,
        compressedTokens: 8,
        omittedChars: 8,
        savedChars: 8,
        savedTokens: 8,
        compressionRatio: 0.5,
        tokenCompressionRatio: 0.5,
        reason: "Marked by test compressor.",
      }),
    ]);
  });

  it("uses rule-based compression by default when no compressor is provided", () => {
    const section = {
      id: "plain",
      content: "0123456789".repeat(300),
      source: {kind: "file" as const},
    };
    const compression = new ContextCompressionPipeline({
      thresholdRatio: 0,
      minSectionTokens: 1,
      tokenEstimator: charTokenEstimator,
    }).compress([section], rawBudget(4_000));

    expect(compression.triggered).toBe(true);
    expect(compression.sections[0]?.content.length).toBeLessThan(section.content.length);
    expect(compression.results).toEqual([
      expect.objectContaining({
        compressed: true,
        strategy: "rule-based-head-tail",
      }),
    ]);
  });

  it("truncates text to a token limit without exceeding the limit", () => {
    const truncated = truncateTextToTokens(
      "line-one\nline-two\nline-three",
      10,
      charTokenEstimator,
    );

    expect(charTokenEstimator.countText(truncated)).toBeLessThanOrEqual(10);
    expect(truncated).toBe("line-one\n");
  });

  it("creates compression results through the shared factory", () => {
    const factory = new ContextCompressionResultFactory();
    const original = {content: "abcdefghij"};
    const compressed = {content: "abc"};

    expect(factory.skipped(original, "skip")).toMatchObject({
      section: original,
      originalSection: original,
      compressed: false,
      reason: "skip",
    });
    expect(factory.compressed(compressed, original, "compressed")).toMatchObject({
      section: compressed,
      originalSection: original,
      compressed: true,
      originalChars: 10,
      compressedChars: 3,
      savedChars: 7,
      omittedChars: 7,
      compressionRatio: 0.3,
      reason: "compressed",
    });
  });

  it("rule-based compressor only compresses long tool and file sections", () => {
    const compressor = new RuleBasedContextCompressor({
      maxSectionTokens: 80,
      minSectionTokens: 80,
      maxSectionChars: 80,
      headChars: 20,
      tailChars: 10,
      tokenEstimator: charTokenEstimator,
    });
    const longContent = "abcdefghijklmnopqrstuvwxyz".repeat(10);
    const kinds = ["user", "memory", "workspace", "provider", "system"] as const;

    for (const kind of kinds) {
      const section = {content: longContent, source: {kind}};
      expect(compressor.compress(section, budgetFor(section))).toMatchObject({
        section,
        originalSection: section,
        compressed: false,
        reason: "Section source is not compressible.",
      });
    }

    for (const kind of ["tool", "file"] as const) {
      const section = {content: longContent, source: {kind}};
      const result = compressor.compress(section, budgetFor(section));

      expect(result.compressed).toBe(true);
      expect(result.section.content).toContain("abcdefghij");
      expect(result.section.content).toContain("uvwxyz");
      expect(result.section.content).toMatch(
        /\[\.\.\.\d+ chars omitted by rule-based-head-tail compressor\.\.\.\]/,
      );
      expect(result.section.content.length).toBeLessThan(longContent.length);
      expect(result.section.content.length).toBeLessThanOrEqual(80);
      expect(result).toMatchObject({
        strategy: "rule-based-head-tail",
        maxSectionTokens: 80,
        maxSectionChars: 80,
      });
      expect(result.omittedChars).toBeGreaterThan(0);
      expect(result.savedChars).toBeGreaterThan(0);
      expect(result.compressionRatio).toBeLessThan(1);
    }
  });

  it("reports omitted original chars separately from saved chars", () => {
    const compressor = new RuleBasedContextCompressor({
      maxSectionTokens: 90,
      minSectionTokens: 90,
      maxSectionChars: 90,
      minSectionChars: 90,
      maxSectionRatio: 1,
      headChars: 20,
      tailChars: 20,
      preserveLineBoundaries: false,
      tokenEstimator: charTokenEstimator,
    });
    const section = {
      content: "0123456789".repeat(30),
      source: {kind: "tool" as const},
    };
    const result = compressor.compress(section, rawBudget(90));
    const markerMatch = /\[\.\.\.(\d+) chars omitted/.exec(result.section.content);

    expect(result.compressed).toBe(true);
    expect(markerMatch?.[1]).toBe(String(result.omittedChars));
    expect(result.omittedChars).toBeGreaterThan(result.savedChars ?? 0);
    expect(result.savedChars).toBe(result.originalChars - result.compressedChars);
    expect(result.section.content.length).toBeLessThanOrEqual(
      result.maxSectionChars ?? 0,
    );
  });

  it("supports explicit zero head or tail retention", () => {
    const section = {
      content: "HEAD-".repeat(20) + "TAIL-".repeat(20),
      source: {kind: "tool" as const},
    };
    const tailOnly = new RuleBasedContextCompressor({
      maxSectionTokens: 80,
      minSectionTokens: 80,
      maxSectionChars: 80,
      minSectionChars: 80,
      maxSectionRatio: 1,
      headChars: 0,
      tailChars: 20,
      preserveLineBoundaries: false,
      tokenEstimator: charTokenEstimator,
    }).compress(section, rawBudget(80));
    const headOnly = new RuleBasedContextCompressor({
      maxSectionTokens: 80,
      minSectionTokens: 80,
      maxSectionChars: 80,
      minSectionChars: 80,
      maxSectionRatio: 1,
      headChars: 20,
      tailChars: 0,
      preserveLineBoundaries: false,
      tokenEstimator: charTokenEstimator,
    }).compress(section, rawBudget(80));

    expect(tailOnly.section.content.startsWith("\n\n[...")).toBe(true);
    expect(tailOnly.section.content).toContain("TAIL-");
    expect(headOnly.section.content.startsWith("HEAD-")).toBe(true);
    expect(headOnly.section.content.endsWith("compressor...]\n\n")).toBe(true);
  });

  it("uses default head-heavy allocation when head and tail are both zero", () => {
    const section = {
      content: "abcdefghijklmnopqrstuvwxyz".repeat(20),
      source: {kind: "file" as const},
    };
    const result = new RuleBasedContextCompressor({
      maxSectionTokens: 100,
      minSectionTokens: 100,
      maxSectionChars: 100,
      minSectionChars: 100,
      maxSectionRatio: 1,
      headChars: 0,
      tailChars: 0,
      preserveLineBoundaries: false,
      tokenEstimator: charTokenEstimator,
    }).compress(section, rawBudget(100));
    const markerStart = result.section.content.indexOf("[...");
    const markerEnd = result.section.content.indexOf("]\n\n");
    const head = result.section.content.slice(0, markerStart);
    const tail = result.section.content.slice(markerEnd + 3);

    expect(head.length).toBeGreaterThan(tail.length);
    expect(result.section.content.length).toBeLessThanOrEqual(100);
  });

  it("uses ContextBudget to resolve dynamic per-section compression limits", () => {
    const compressor = new RuleBasedContextCompressor({
      maxSectionTokens: 500,
      minSectionTokens: 80,
      maxSectionChars: 500,
      minSectionChars: 80,
      maxSectionRatio: 0.25,
      headChars: 60,
      tailChars: 40,
      preserveLineBoundaries: false,
      tokenEstimator: charTokenEstimator,
    });
    const section = {
      content: "0123456789".repeat(100),
      source: {kind: "tool" as const},
    };
    const smallBudgetResult = compressor.compress(section, rawBudget(400));
    const largeBudgetResult = compressor.compress(section, rawBudget(20_000));

    expect(smallBudgetResult.compressed).toBe(true);
    expect(smallBudgetResult.maxSectionTokens).toBe(100);
    expect(smallBudgetResult.compressedTokens).toBeLessThanOrEqual(100);
    expect(largeBudgetResult.compressed).toBe(true);
    expect(largeBudgetResult.maxSectionTokens).toBe(500);
    expect(largeBudgetResult.section.content.length).toBeGreaterThan(
      smallBudgetResult.section.content.length,
    );
  });

  it("does not compress tool or file sections below the dynamic limit", () => {
    const compressor = new RuleBasedContextCompressor({
      maxSectionTokens: 500,
      minSectionTokens: 1,
      maxSectionChars: 500,
      minSectionChars: 1,
      maxSectionRatio: 1,
      tokenEstimator: charTokenEstimator,
    });
    const section = {
      content: "short tool output",
      source: {kind: "tool" as const},
    };
    const result = compressor.compress(section, budgetFor(section));

    expect(result).toMatchObject({
      section,
      originalSection: section,
      compressed: false,
      reason: "Section is within the dynamic section token limit (17 <= 100 tokens).",
      strategy: "rule-based-head-tail",
      maxSectionTokens: 100,
    });
  });

  it("preserves line boundaries for head and tail slices when configured", () => {
    const compressor = new RuleBasedContextCompressor({
      maxSectionTokens: 140,
      minSectionTokens: 140,
      maxSectionChars: 140,
      minSectionChars: 140,
      maxSectionRatio: 1,
      headChars: 40,
      tailChars: 40,
      headTokenRatio: 0.5,
      tailTokenRatio: 0.5,
      preserveLineBoundaries: true,
      tokenEstimator: charTokenEstimator,
    });
    const section = {
      content: [
        "head-line-1",
        "head-line-2",
        "head-line-3",
        "middle-line".repeat(12),
        "tail-line-1",
        "tail-line-2",
      ].join("\n"),
      source: {kind: "file" as const},
    };
    const result = compressor.compress(section, rawBudget(140));

    expect(result.compressed).toBe(true);
    expect(result.section.content).toContain("head-line-1\nhead-line-2\n");
    expect(result.section.content).not.toContain("middle-linemiddle-line");
    expect(result.section.content).toContain("tail-line-1\ntail-line-2");
  });

  it("falls back to plain line slicing when line preservation would keep too little", () => {
    const compressor = new RuleBasedContextCompressor({
      maxSectionTokens: 100,
      minSectionTokens: 100,
      maxSectionChars: 100,
      minSectionChars: 100,
      maxSectionRatio: 1,
      headChars: 10,
      tailChars: 10,
      headTokenRatio: 0.5,
      tailTokenRatio: 0.5,
      preserveLineBoundaries: true,
      tokenEstimator: charTokenEstimator,
    });
    const section = {
      content: `ab\n${"c".repeat(120)}\n${"d".repeat(120)}\nij`,
      source: {kind: "tool" as const},
    };
    const result = compressor.compress(section, rawBudget(100));

    expect(result.section.content).toContain("ab\nccccc");
    expect(result.section.content).toContain("ddddd\nij");
  });

  it("normalizes invalid rule-based compressor options without throwing", () => {
    const compressor = new RuleBasedContextCompressor({
      maxSectionChars: 0,
      minSectionChars: 99_999,
      maxSectionTokens: 0,
      minSectionTokens: 99_999,
      maxSectionRatio: 10,
      headChars: -1,
      tailChars: -1,
      tokenEstimator: charTokenEstimator,
    });
    const section = {
      content: "x".repeat(20_000),
      source: {kind: "tool" as const},
    };
    const result = compressor.compress(section, rawBudget(100));

    expect(result.compressed).toBe(true);
    expect(result.section.content.trim().length).toBeGreaterThan(0);
    expect(result.maxSectionTokens).toBe(8_000);
  });

  it("keeps omission marker details visible through compressor output", () => {
    const section = {
      content: "abcdefghijklmnopqrstuvwxyz".repeat(20),
      source: {kind: "tool" as const},
    };
    const result = new RuleBasedContextCompressor({
      maxSectionTokens: 100,
      minSectionTokens: 100,
      maxSectionChars: 100,
      minSectionChars: 100,
      maxSectionRatio: 1,
      preserveLineBoundaries: false,
      tokenEstimator: charTokenEstimator,
    }).compress(section, rawBudget(100));

    expect(result.section.content).toMatch(
      new RegExp(`\\[\\.\\.\\.${result.omittedChars} chars omitted`),
    );
  });
});

function budgetFor(section: ContextSection): ContextBudget {
  return new DefaultContextBudgetPolicy({reservedOutputTokens: 0}).createBudget({
    sections: [section],
    tokenLimit: 100,
  });
}

function fixedRuntimeBudgetPolicy(runtimeContextTokens: number): ContextBudgetPolicy {
  const basePolicy = new DefaultContextBudgetPolicy({reservedOutputTokens: 0});

  return {
    createBudget(input, tokenEstimator) {
      return {
        ...basePolicy.createBudget(input, tokenEstimator),
        runtimeContextTokens,
      };
    },
  };
}

function rawBudget(runtimeContextTokens: number): ContextBudget {
  return {
    tokenLimit: runtimeContextTokens,
    modelContextWindow: runtimeContextTokens,
    reservedOutputTokens: 0,
    systemPromptTokens: 0,
    outputInstructionTokens: 0,
    toolSchemaTokens: 0,
    conversationTokens: 0,
    safetyMarginTokens: 0,
    runtimeContextTokens,
  };
}
