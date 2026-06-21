import type {ContextBudget, ContextCompressionResult, ContextSection} from "./types.js";

/** Extension point for pre-truncation context compression. */
export interface ContextCompressor {
  compress(section: ContextSection, budget: ContextBudget): ContextCompressionResult;
}

/** Default compressor that leaves sections unchanged. */
export class NoopContextCompressor implements ContextCompressor {
  compress(section: ContextSection, _budget: ContextBudget): ContextCompressionResult {
    return {section, compressed: false};
  }
}
