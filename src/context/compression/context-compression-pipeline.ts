import {
  ContextCompressionResultFactory,
  NoopContextCompressor,
  type ContextCompressor,
} from "./context-compressor.js";
import {
  createDefaultTokenEstimator,
  type TokenEstimator,
} from "../budget/token-estimator.js";
import {formatContextSection} from "../formatting/context-formatter.js";
import type {ContextBudget, ContextCompressionResult, ContextSection} from "../types.js";

export type ContextCompressionPipelineOptions = {
  compressor?: ContextCompressor;
  thresholdRatio?: number;
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
  private readonly resultFactory: ContextCompressionResultFactory;
  private readonly tokenEstimator: TokenEstimator;

  constructor(options: ContextCompressionPipelineOptions = {}) {
    this.resultFactory = options.resultFactory ?? new ContextCompressionResultFactory();
    this.compressor = options.compressor ?? new NoopContextCompressor(this.resultFactory);
    this.thresholdRatio = options.thresholdRatio ?? 0.85;
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();
  }

  compress(
    sections: readonly ContextSection[],
    budget: ContextBudget,
  ): ContextCompressionPipelineResult {
    const formattedContextText = formatContextSections(sections);
    const estimatedContextChars = formattedContextText.length;
    const estimatedContextTokens = this.tokenEstimator.countText(formattedContextText);
    const compressionLimitTokens = Math.floor(
      budget.maxInputTokens * this.thresholdRatio,
    );
    const triggered = estimatedContextTokens > compressionLimitTokens;
    const results = triggered
      ? sections.map((section) => this.compressor.compress(section, budget))
      : sections.map((section) =>
          this.resultFactory.skipped(section, "Compression was not triggered.", {
            originalTokens: this.tokenEstimator.countText(section.content),
            compressedTokens: this.tokenEstimator.countText(section.content),
            savedTokens: 0,
            tokenCompressionRatio: section.content ? 1 : 0,
          }),
        );

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
}

function formatContextSections(sections: readonly ContextSection[]): string {
  return sections
    .map((section) => formatContextSection(section))
    .filter((text) => text.length > 0)
    .join("\n\n");
}
