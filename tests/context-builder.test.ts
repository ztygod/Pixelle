import {describe, expect, it} from "vitest";

import {
  ApproxTokenEstimator,
  ContextCompressionPipeline,
  ContextCompressionResultFactory,
  ContextBudgeter,
  ContextTruncator,
  createDefaultTokenEstimator,
  DefaultContextBudgetPolicy,
  DefaultContextPriorityPolicy,
  GptTokenEstimator,
  PromptAssembler,
  RuleBasedContextCompressor,
  truncateTextToTokens,
  type ContextBudget,
  type ContextCompressionResult,
  type ContextCompressor,
  type ContextBudgetPolicy,
  type ContextPriorityPolicy,
  type ContextDocument,
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

type TestBuildInput = {
  systemPrompt?: string;
  outputInstructions?: string;
  sections: readonly ContextSection[];
  tokenLimit: number;
};

type TestContextPipelineOptions = {
  priorityPolicy?: ContextPriorityPolicy;
  budgetPolicy?: ContextBudgetPolicy;
  compressionPipeline?: ContextCompressionPipeline;
  compressor?: ContextCompressor;
  compressionThresholdRatio?: number;
  truncator?: ContextTruncator;
  tokenEstimator?: TokenEstimator;
};

/** Test-only composition proving the four context layers work together. */
class TestContextPipeline {
  private readonly tokenEstimator: TokenEstimator;
  private readonly budgeter: ContextBudgeter;
  private readonly compressionPipeline: ContextCompressionPipeline;
  private readonly truncator: ContextTruncator;
  private readonly assembler = new PromptAssembler();

  constructor(options: TestContextPipelineOptions = {}) {
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();
    this.compressionPipeline =
      options.compressionPipeline ??
      new ContextCompressionPipeline({
        compressor: options.compressor,
        tokenEstimator: this.tokenEstimator,
      });
    this.budgeter = new ContextBudgeter({
      priorityPolicy: options.priorityPolicy ?? new DefaultContextPriorityPolicy(),
      budgetPolicy: options.budgetPolicy ?? new DefaultContextBudgetPolicy(),
      compressionThresholdRatio: options.compressionThresholdRatio,
      tokenEstimator: this.tokenEstimator,
    });
    this.truncator =
      options.truncator ?? new ContextTruncator({tokenEstimator: this.tokenEstimator});
  }

  build(input: TestBuildInput) {
    const document: ContextDocument = {
      systemPrompt: input.systemPrompt,
      outputInstructions: input.outputInstructions,
      sections: input.sections,
      transcript: [],
      metadata: {runId: "test", iteration: 0, stage: "agent"},
    };
    const budgeted = this.budgeter.budget(
      document,
      {messages: [], archivedSections: []},
      input.tokenLimit,
    );
    const compression = this.compressionPipeline.process(budgeted);
    const truncation = this.truncator.truncate(compression.sections, budgeted.budget);
    const systemPrompt = this.assembler.assembleSystemPrompt(
      document,
      truncation.contextText,
    );
    const contextTextTokens = this.tokenEstimator.countText(truncation.contextText);
    const systemPromptTokens = this.tokenEstimator.countText(systemPrompt);

    return {
      systemPrompt,
      contextText: truncation.contextText,
      tokenEstimate: systemPromptTokens,
      includedSections: truncation.includedSections,
      partialSections: truncation.partialSections,
      droppedSections: truncation.droppedSections,
      sectionUsages: truncation.sectionUsages,
      diagnostics: {
        budget: budgeted.budget,
        estimatedContextChars: compression.estimatedContextChars,
        estimatedContextTokens: compression.estimatedContextTokens,
        compressionThresholdRatio: compression.thresholdRatio,
        compressionTriggered: compression.triggered,
        compressionLimitTokens: compression.compressionLimitTokens,
        compressionResults: compression.results,
        contextTextTokens,
        systemPromptTokens,
      },
    };
  }
}

function buildContext(input: TestBuildInput) {
  return new TestContextPipeline().build(input);
}

describe("context pipeline", () => {
  it("separates budget decisions from compression execution", () => {
    const budgeted = new ContextBudgeter({
      budgetPolicy: new DefaultContextBudgetPolicy({reservedOutputTokens: 0}),
      compressionThresholdRatio: 0.5,
      tokenEstimator: charTokenEstimator,
    }).budget(
      {
        systemPrompt: "Base.",
        sections: [{id: "long", content: "abcdefgh", priority: 10}],
        transcript: [],
        metadata: {runId: "test", iteration: 1, stage: "agent"},
      },
      {messages: [], archivedSections: []},
      10,
    );

    expect(budgeted.sections.map((section) => section.id)).toEqual(["long"]);
    expect(budgeted.compressionRequired).toBe(true);
    expect(budgeted.diagnostics).toEqual({
      estimatedContextChars: 8,
      estimatedContextTokens: 8,
      compressionLimitTokens: 5,
      compressionThresholdRatio: 0.5,
    });
  });

  it("provides approximate and gpt-backed token estimators", () => {
    const approx = new ApproxTokenEstimator();
    const gpt = new GptTokenEstimator();

    expect(approx.countText("hello world")).toBeGreaterThan(0);
    expect(gpt.countText("hello world")).toBeGreaterThan(0);
  });

  it("sorts context sections by descending priority", () => {
    const result = new TestContextPipeline().build({
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
    const result = new TestContextPipeline().build({
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
    const result = buildContext({
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
    const result = buildContext({
      systemPrompt: "Base.",
      sections: [{title: "Notes", content: "  keep this  "}],
      tokenLimit: 100,
    });

    expect(result.contextText).toBe("## Notes\nkeep this");
  });

  it("builds a token-first runtime context budget policy", () => {
    expect(
      new DefaultContextBudgetPolicy().createBudget({
        tokenLimit: 100,
      }),
    ).toEqual({
      tokenLimit: 100,
      maxContextTokens: 100,
      reservedOutputTokens: 20,
      maxInputTokens: 80,
    });
  });

  it("truncates over-budget runtime context and records included, partial, and dropped sections", () => {
    const result = new TestContextPipeline({
      budgetPolicy: new DefaultContextBudgetPolicy({reservedOutputTokens: 0}),
      tokenEstimator: charTokenEstimator,
    }).build({
      systemPrompt: "Base.",
      sections: [
        {id: "first", content: "abcdefghij", priority: 10},
        {id: "second", content: "klmnopqrst", priority: 9},
      ],
      tokenLimit: 4,
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
    expect(result.diagnostics?.contextTextTokens).toBe(4);
    expect(result.tokenEstimate).toBe(charTokenEstimator.countText(result.systemPrompt));
  });

  it("keeps fully injected sections separate from partial and dropped sections", () => {
    const result = new TestContextPipeline({
      budgetPolicy: new DefaultContextBudgetPolicy({reservedOutputTokens: 0}),
      tokenEstimator: charTokenEstimator,
    }).build({
      systemPrompt: "Base.",
      sections: [
        {id: "first", content: "abc", priority: 10},
        {id: "second", content: "defghij", priority: 9},
        {id: "third", content: "klm", priority: 8},
      ],
      tokenLimit: 7,
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
        status: "dropped",
        reason: "No remaining context budget for this section.",
      }),
    ]);
  });

  it("builds system prompt with output instructions and runtime context", () => {
    const result = buildContext({
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
    const budgeted = budgetContext(
      [
        {id: "same", content: "old"},
        {id: "same", content: "new"},
        {replaceKey: "profile", content: "old profile"},
        {replaceKey: "profile", content: "new profile"},
        {content: "kept"},
      ],
      100,
      0.85,
    );

    expect(budgeted.sections.map((section) => section.content)).toEqual([
      "new",
      "new profile",
      "kept",
    ]);
  });

  it("does not trigger compression below the configured threshold", () => {
    const compressor = new ThrowingCompressor();
    const pipeline = new ContextCompressionPipeline({
      compressor,
      tokenEstimator: charTokenEstimator,
    });
    const compression = pipeline.process(
      budgetContext([{id: "short", content: "short"}], 100, 0.85),
    );
    const result = new TestContextPipeline({
      compressionPipeline: pipeline,
      compressionThresholdRatio: 0.85,
      tokenEstimator: charTokenEstimator,
    }).build({
      systemPrompt: "Base.",
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
        reason: "Compression was not triggered.",
      }),
    ]);
    expect(result.diagnostics).toMatchObject({
      compressionThresholdRatio: 0.85,
      compressionTriggered: false,
      estimatedContextChars: 5,
      estimatedContextTokens: 5,
      compressionLimitTokens: 68,
    });
    expect(result.diagnostics?.compressionResults).toEqual([
      expect.objectContaining({
        section: expect.objectContaining({id: "short"}),
        compressed: false,
        originalChars: 5,
        compressedChars: 5,
        reason: "Compression was not triggered.",
      }),
    ]);
  });

  it("triggers compression above the configured threshold and exposes diagnostics", () => {
    const pipeline = new ContextCompressionPipeline({
      compressor: new MarkingCompressor(),
      tokenEstimator: charTokenEstimator,
    });
    const result = new TestContextPipeline({
      compressionPipeline: pipeline,
      compressionThresholdRatio: 0.5,
      budgetPolicy: new DefaultContextBudgetPolicy({reservedOutputTokens: 0}),
      tokenEstimator: charTokenEstimator,
    }).build({
      systemPrompt: "Base prompt.",
      outputInstructions: "Use Markdown.",
      sections: [{id: "long", content: "abcdefghijklmnop", source: {kind: "tool"}}],
      tokenLimit: 8,
    });

    expect(result.contextText).toBe("abcdefgh");
    expect(result.tokenEstimate).toBe(charTokenEstimator.countText(result.systemPrompt));
    expect(result.diagnostics).toMatchObject({
      budget: {
        tokenLimit: 8,
        maxContextTokens: 8,
        reservedOutputTokens: 0,
        maxInputTokens: 8,
      },
      estimatedContextChars: 16,
      estimatedContextTokens: 16,
      compressionThresholdRatio: 0.5,
      compressionTriggered: true,
      compressionLimitTokens: 4,
      contextTextTokens: charTokenEstimator.countText(result.contextText),
      systemPromptTokens: charTokenEstimator.countText(result.systemPrompt),
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

  it("uses a default noop compression pipeline when no compressor is provided", () => {
    const compression = new ContextCompressionPipeline({
      tokenEstimator: charTokenEstimator,
    }).process(budgetContext([{id: "plain", content: "plain"}], 1, 0));

    expect(compression.triggered).toBe(true);
    expect(compression.sections).toEqual([{id: "plain", content: "plain"}]);
    expect(compression.results).toEqual([
      expect.objectContaining({
        compressed: false,
        reason: "No compression applied.",
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
      expect(compressor.compress(section, budgetFor())).toMatchObject({
        section,
        originalSection: section,
        compressed: false,
        reason: "Section source is not compressible.",
      });
    }

    for (const kind of ["tool", "file"] as const) {
      const section = {content: longContent, source: {kind}};
      const result = compressor.compress(section, budgetFor());

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
    const result = compressor.compress(section, budgetFor());

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

function budgetFor(): ContextBudget {
  return new DefaultContextBudgetPolicy({reservedOutputTokens: 0}).createBudget({
    tokenLimit: 100,
  });
}

function budgetContext(
  sections: readonly ContextSection[],
  tokenLimit: number,
  compressionThresholdRatio: number,
) {
  return new ContextBudgeter({
    budgetPolicy: new DefaultContextBudgetPolicy({reservedOutputTokens: 0}),
    compressionThresholdRatio,
    tokenEstimator: charTokenEstimator,
  }).budget(
    {
      sections,
      transcript: [],
      metadata: {runId: "test", iteration: 0, stage: "agent"},
    },
    {messages: [], archivedSections: []},
    tokenLimit,
  );
}

function rawBudget(maxInputTokens: number): ContextBudget {
  return {
    tokenLimit: maxInputTokens,
    maxContextTokens: maxInputTokens,
    reservedOutputTokens: 0,
    maxInputTokens,
  };
}
