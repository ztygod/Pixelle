import {
  ContextCompressionResultFactory,
  NoopContextCompressor,
  type ContextCompressor,
} from "./context-compressor.js";
import {formatContextSection} from "./context-formatter.js";
import type {ContextBudget, ContextCompressionResult, ContextSection} from "./types.js";

export type ContextCompressionPipelineOptions = {
  compressor?: ContextCompressor;
  thresholdRatio?: number;
  resultFactory?: ContextCompressionResultFactory;
};

export type ContextCompressionPipelineResult = {
  sections: ContextSection[];
  results: ContextCompressionResult[];
  estimatedContextChars: number;
  thresholdRatio: number;
  triggered: boolean;
};

/** Decides when to apply context compression and records compression diagnostics. */
export class ContextCompressionPipeline {
  private readonly compressor: ContextCompressor;
  private readonly thresholdRatio: number;
  private readonly resultFactory: ContextCompressionResultFactory;

  constructor(options: ContextCompressionPipelineOptions = {}) {
    this.resultFactory = options.resultFactory ?? new ContextCompressionResultFactory();
    this.compressor = options.compressor ?? new NoopContextCompressor(this.resultFactory);
    this.thresholdRatio = options.thresholdRatio ?? 0.85;
  }

  compress(
    sections: readonly ContextSection[],
    budget: ContextBudget,
  ): ContextCompressionPipelineResult {
    const estimatedContextChars = estimateFormattedContextChars(sections);
    const compressionLimit = budget.maxContextChars * this.thresholdRatio;
    const triggered = estimatedContextChars > compressionLimit;
    const results = triggered
      ? sections.map((section) => this.compressor.compress(section, budget))
      : sections.map((section) =>
          this.resultFactory.skipped(section, "Compression was not triggered."),
        );

    return {
      sections: results.map((result) => result.section),
      results,
      estimatedContextChars,
      thresholdRatio: this.thresholdRatio,
      triggered,
    };
  }
}

function estimateFormattedContextChars(sections: readonly ContextSection[]): number {
  const blocks = sections
    .map((section) => formatContextSection(section))
    .filter((text) => text.length > 0);

  if (!blocks.length) {
    return 0;
  }

  return (
    blocks.reduce((total, block) => total + block.length, 0) + (blocks.length - 1) * 2
  );
}
