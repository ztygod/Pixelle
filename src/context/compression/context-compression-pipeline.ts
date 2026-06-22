import {
  ContextCompressionResultFactory,
  RuleBasedContextCompressor,
  type ContextCompressor,
} from "./context-compressor.js";
import {
  createDefaultTokenEstimator,
  type TokenEstimator,
} from "../budget/token-estimator.js";
import {formatContextSection} from "../assembler/context-formatter.js";
import type {ContextBudget, ContextCompressionResult, ContextSection} from "../types.js";

export type ContextCompressionPipelineOptions = {
  compressor?: ContextCompressor;
  thresholdRatio?: number;
  minSectionTokens?: number;
  resultFactory?: ContextCompressionResultFactory;
  tokenEstimator?: TokenEstimator;
};

export type ContextCompressionPipelineResult = {
  sections: ContextSection[];
  results: ContextCompressionResult[];
  estimatedContextChars: number;
  estimatedContextTokens: number;
  compressionLimitTokens: number;
  thresholdRatio: number;
  triggered: boolean;
};

/** Decides when to apply context compression and records compression diagnostics. */
export class ContextCompressionPipeline {
  private readonly compressor: ContextCompressor;
  private readonly thresholdRatio: number;
  private readonly minSectionTokens: number;
  private readonly resultFactory: ContextCompressionResultFactory;
  private readonly tokenEstimator: TokenEstimator;

  constructor(options: ContextCompressionPipelineOptions = {}) {
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();
    this.resultFactory =
      options.resultFactory ?? new ContextCompressionResultFactory(this.tokenEstimator);
    // Default to real rule-based compression; callers can inject a custom strategy.
    this.compressor =
      options.compressor ??
      new RuleBasedContextCompressor(
        {tokenEstimator: this.tokenEstimator},
        this.resultFactory,
      );
    this.thresholdRatio = clampNumber(options.thresholdRatio ?? 0.85, 0, 1);
    this.minSectionTokens = nonNegativeIntegerOrDefault(options.minSectionTokens, 200);
  }

  compress(
    sections: readonly ContextSection[],
    budget: ContextBudget,
  ): ContextCompressionPipelineResult {
    // Estimate the full formatted context before deciding whether compression is needed.
    const formattedContextText = formatContextSections(sections);
    const estimatedContextChars = formattedContextText.length;
    const estimatedContextTokens = this.tokenEstimator.countText(formattedContextText);
    const compressionLimitTokens = Math.floor(
      budget.runtimeContextTokens * this.thresholdRatio,
    );
    const triggered = estimatedContextTokens > compressionLimitTokens;
    const results = sections.map((section) => {
      const originalTokens = this.tokenEstimator.countText(section.content);
      // Policy skips are recorded as compression results for diagnostics.
      const skipReason = this.skipReason(section, originalTokens, triggered);

      if (skipReason) {
        return this.resultFactory.skipped(section, skipReason, {
          originalTokens,
          compressedTokens: originalTokens,
          savedTokens: 0,
          tokenCompressionRatio: section.content ? 1 : 0,
        });
      }

      return this.compressor.compress(section, budget);
    });

    return {
      sections: results.map((result) => result.section),
      results,
      estimatedContextChars,
      estimatedContextTokens,
      compressionLimitTokens,
      thresholdRatio: this.thresholdRatio,
      triggered,
    };
  }

  private skipReason(
    section: ContextSection,
    originalTokens: number,
    triggered: boolean,
  ): string | undefined {
    // Global threshold prevents unnecessary work when context already fits comfortably.
    if (!triggered) {
      return "Compression was not triggered because runtime context is below the configured total threshold.";
    }

    if (section.compressible === false) {
      return "Section opted out of compression.";
    }

    if (section.required && section.truncation === "none") {
      return "Required section disallows truncation and is protected from compression.";
    }

    if (originalTokens < this.minSectionTokens) {
      return `Section is below the minimum compression threshold (${originalTokens} < ${this.minSectionTokens} tokens).`;
    }

    // Only compress source types whose content can be safely summarized or abbreviated.
    if (!isSafeToCompress(section)) {
      return "Section type is not safe to compress.";
    }

    return undefined;
  }
}

function formatContextSections(sections: readonly ContextSection[]): string {
  return sections
    .map((section) => formatContextSection(section))
    .filter((text) => text.length > 0)
    .join("\n\n");
}

function isSafeToCompress(section: ContextSection): boolean {
  if (section.metadata?.safeToCompress === true) {
    return true;
  }

  if (section.metadata?.safeToCompress === false) {
    return false;
  }

  if (section.source?.kind === "file") {
    return true;
  }

  if (section.source?.kind !== "tool") {
    return false;
  }

  const toolPart = section.metadata?.toolPart;
  if (toolPart && toolPart !== "result") {
    return false;
  }

  const kind = section.metadata?.toolResultKind;
  return (
    kind === "bash" ||
    kind === "test" ||
    kind === "grep" ||
    kind === "read_file" ||
    kind === "old_tool_result" ||
    kind === undefined
  );
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, value));
}

function nonNegativeIntegerOrDefault(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}
