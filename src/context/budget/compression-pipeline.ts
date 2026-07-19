import {
  ContextCompressionResultFactory,
  NoopContextCompressor,
  type ContextCompressor,
} from "./compressor.js";
import {createDefaultTokenEstimator, type TokenEstimator} from "./token-estimator.js";
import type {
  BudgetedContext,
  ContextCompressionResult,
  ContextSection,
} from "../types.js";

export type ContextCompressionPipelineOptions = {
  compressor?: ContextCompressor;
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

/** Executes the compression decision produced by ContextBudgeter. */
export class ContextCompressionPipeline {
  private readonly compressor: ContextCompressor;
  private readonly resultFactory: ContextCompressionResultFactory;
  private readonly tokenEstimator: TokenEstimator;

  constructor(options: ContextCompressionPipelineOptions = {}) {
    this.resultFactory = options.resultFactory ?? new ContextCompressionResultFactory();
    this.compressor = options.compressor ?? new NoopContextCompressor(this.resultFactory);
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();
  }

  /** Executes a compression decision made by ContextBudgeter. */
  process(budgeted: BudgetedContext): ContextCompressionPipelineResult {
    const results = budgeted.compressionRequired
      ? budgeted.sections.map((section) =>
          this.compressor.compress(section, budgeted.budget),
        )
      : budgeted.sections.map((section) =>
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
      estimatedContextChars: budgeted.diagnostics.estimatedContextChars,
      estimatedContextTokens: budgeted.diagnostics.estimatedContextTokens,
      compressionLimitTokens: budgeted.diagnostics.compressionLimitTokens,
      thresholdRatio: budgeted.diagnostics.compressionThresholdRatio,
      triggered: budgeted.compressionRequired,
    };
  }
}
