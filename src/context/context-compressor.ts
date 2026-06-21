import {createDefaultTokenEstimator, type TokenEstimator} from "./token-estimator.js";
import type {ContextBudget, ContextCompressionResult, ContextSection} from "./types.js";

export type ContextCompressionMetadata = {
  strategy?: string;
  maxSectionChars?: number;
  maxSectionTokens?: number;
  omittedChars?: number;
  savedChars?: number;
  originalTokens?: number;
  compressedTokens?: number;
  savedTokens?: number;
  tokenCompressionRatio?: number;
};

type HeadTailParts = {
  head: string;
  tail: string;
  marker: string;
  content: string;
  omittedChars: number;
};

/** Extension point for pre-truncation context compression. */
export interface ContextCompressor {
  compress(section: ContextSection, budget: ContextBudget): ContextCompressionResult;
}

/** Creates normalized compression results for compressors and pipelines. */
export class ContextCompressionResultFactory {
  private readonly tokenEstimator: TokenEstimator;

  constructor(tokenEstimator: TokenEstimator = createDefaultTokenEstimator()) {
    this.tokenEstimator = tokenEstimator;
  }

  unchanged(
    section: ContextSection,
    reason: string,
    metadata: ContextCompressionMetadata = {},
  ): ContextCompressionResult {
    return this.create(section, section, false, reason, metadata);
  }

  compressed(
    section: ContextSection,
    originalSection: ContextSection,
    reason: string,
    metadata: ContextCompressionMetadata = {},
  ): ContextCompressionResult {
    return this.create(section, originalSection, true, reason, metadata);
  }

  skipped(
    section: ContextSection,
    reason: string,
    metadata: ContextCompressionMetadata = {},
  ): ContextCompressionResult {
    return this.create(section, section, false, reason, metadata);
  }

  private create(
    section: ContextSection,
    originalSection: ContextSection,
    compressed: boolean,
    reason: string,
    metadata: ContextCompressionMetadata,
  ): ContextCompressionResult {
    const savedChars =
      metadata.savedChars ??
      Math.max(0, originalSection.content.length - section.content.length);
    const omittedChars = metadata.omittedChars ?? savedChars;
    const compressionRatio =
      originalSection.content.length > 0
        ? section.content.length / originalSection.content.length
        : 1;
    const originalTokens =
      metadata.originalTokens ?? this.tokenEstimator.countText(originalSection.content);
    const compressedTokens =
      metadata.compressedTokens ?? this.tokenEstimator.countText(section.content);
    const savedTokens =
      metadata.savedTokens ?? Math.max(0, originalTokens - compressedTokens);
    const tokenCompressionRatio =
      metadata.tokenCompressionRatio ??
      (originalTokens > 0 ? compressedTokens / originalTokens : 1);

    return {
      section,
      originalSection,
      compressed,
      originalChars: originalSection.content.length,
      compressedChars: section.content.length,
      omittedChars,
      savedChars,
      compressionRatio,
      originalTokens,
      compressedTokens,
      savedTokens,
      tokenCompressionRatio,
      ...metadata,
      reason,
    };
  }
}

/** Default compressor that leaves sections unchanged. */
export class NoopContextCompressor implements ContextCompressor {
  private readonly resultFactory: ContextCompressionResultFactory;

  constructor(resultFactory = new ContextCompressionResultFactory()) {
    this.resultFactory = resultFactory;
  }

  compress(section: ContextSection, _budget: ContextBudget): ContextCompressionResult {
    return this.resultFactory.unchanged(section, "No compression applied.");
  }
}

export type RuleBasedContextCompressorOptions = {
  maxSectionTokens?: number;
  minSectionTokens?: number;
  maxSectionChars?: number;
  minSectionChars?: number;
  maxSectionRatio?: number;
  headTokenRatio?: number;
  tailTokenRatio?: number;
  headChars?: number;
  tailChars?: number;
  preserveLineBoundaries?: boolean;
  tokenEstimator?: TokenEstimator;
};

/** Conservative compressor for oversized tool and file context sections. */
export class RuleBasedContextCompressor implements ContextCompressor {
  private readonly maxSectionTokens: number;
  private readonly minSectionTokens: number;
  private readonly maxSectionChars: number;
  private readonly minSectionChars: number;
  private readonly maxSectionRatio: number;
  private readonly headTokenRatio: number;
  private readonly tailTokenRatio: number;
  private readonly headChars: number;
  private readonly tailChars: number;
  private readonly preserveLineBoundaries: boolean;
  private readonly resultFactory: ContextCompressionResultFactory;
  private readonly tokenEstimator: TokenEstimator;

  constructor(
    options: RuleBasedContextCompressorOptions = {},
    resultFactory?: ContextCompressionResultFactory,
  ) {
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();
    const maxSectionTokens = this.positiveIntegerOrDefault(
      options.maxSectionTokens,
      8_000,
    );
    const minSectionTokens = this.positiveIntegerOrDefault(
      options.minSectionTokens,
      1_200,
    );
    const maxSectionChars = this.positiveIntegerOrDefault(options.maxSectionChars, 8_000);
    const minSectionChars = this.positiveIntegerOrDefault(options.minSectionChars, 1_200);

    this.maxSectionTokens = maxSectionTokens;
    this.minSectionTokens = Math.min(minSectionTokens, maxSectionTokens);
    this.maxSectionChars = maxSectionChars;
    this.minSectionChars = Math.min(minSectionChars, maxSectionChars);
    this.maxSectionRatio = this.clampNumber(options.maxSectionRatio ?? 0.25, 0.05, 1);
    this.headTokenRatio = this.clampNumber(options.headTokenRatio ?? 0.67, 0, 1);
    this.tailTokenRatio = this.clampNumber(options.tailTokenRatio ?? 0.33, 0, 1);
    this.headChars = this.nonNegativeIntegerOrDefault(options.headChars, 4_000);
    this.tailChars = this.nonNegativeIntegerOrDefault(options.tailChars, 2_000);
    this.preserveLineBoundaries = options.preserveLineBoundaries ?? true;
    this.resultFactory =
      resultFactory ?? new ContextCompressionResultFactory(this.tokenEstimator);
  }

  compress(section: ContextSection, budget: ContextBudget): ContextCompressionResult {
    if (!isCompressibleSection(section)) {
      return this.resultFactory.unchanged(section, "Section source is not compressible.");
    }

    switch (section.source?.kind) {
      case "tool":
        return this.compressToolSection(section, budget);
      case "file":
        return this.compressFileSection(section, budget);
      default:
        return this.resultFactory.unchanged(
          section,
          "Section source is not compressible.",
        );
    }
  }

  private compressToolSection(
    section: ContextSection,
    budget: ContextBudget,
  ): ContextCompressionResult {
    return this.compressHeadTail(section, this.resolveMaxSectionTokens(budget));
  }

  private compressFileSection(
    section: ContextSection,
    budget: ContextBudget,
  ): ContextCompressionResult {
    return this.compressHeadTail(section, this.resolveMaxSectionTokens(budget));
  }

  private resolveMaxSectionTokens(budget: ContextBudget): number {
    const budgetBasedLimit = Math.floor(budget.maxInputTokens * this.maxSectionRatio);

    return this.clampInteger(
      Math.min(this.maxSectionTokens, budgetBasedLimit),
      this.minSectionTokens,
      this.maxSectionTokens,
    );
  }

  private compressHeadTail(
    section: ContextSection,
    maxSectionTokens: number,
  ): ContextCompressionResult {
    const strategy = "rule-based-head-tail";
    const originalTokens = this.tokenEstimator.countText(section.content);
    const maxSectionChars = this.clampInteger(
      Math.min(this.maxSectionChars, maxSectionTokens * 4),
      this.minSectionChars,
      this.maxSectionChars,
    );

    if (!section.content.trim()) {
      return this.resultFactory.unchanged(
        section,
        "Section content is empty after trimming.",
        {
          strategy,
          maxSectionChars,
          maxSectionTokens,
          originalTokens,
          compressedTokens: originalTokens,
        },
      );
    }

    if (originalTokens <= maxSectionTokens) {
      return this.resultFactory.unchanged(
        section,
        `Section is within the dynamic section token limit (${originalTokens} <= ${maxSectionTokens} tokens).`,
        {
          strategy,
          maxSectionChars,
          maxSectionTokens,
          originalTokens,
          compressedTokens: originalTokens,
        },
      );
    }

    const parts = this.buildHeadTailContent(
      section.content,
      maxSectionChars,
      maxSectionTokens,
      strategy,
    );
    const compressedTokens = this.tokenEstimator.countText(parts.content);

    if (
      !parts.content.trim() ||
      parts.content.length >= section.content.length ||
      compressedTokens >= originalTokens
    ) {
      return this.resultFactory.unchanged(
        section,
        "Rule-based compression would not reduce this section.",
        {
          strategy,
          maxSectionChars,
          maxSectionTokens,
          originalTokens,
          compressedTokens: originalTokens,
        },
      );
    }

    const compressedSection = {...section, content: parts.content};
    const savedChars = section.content.length - parts.content.length;
    const savedTokens = originalTokens - compressedTokens;

    return this.resultFactory.compressed(
      compressedSection,
      section,
      `Section exceeded dynamic section token limit: ${originalTokens} tokens -> ${compressedTokens} tokens, omitted ${parts.omittedChars} original chars, saved ${savedChars} chars and ${savedTokens} tokens using rule-based-head-tail compression.`,
      {
        strategy,
        maxSectionChars,
        maxSectionTokens,
        omittedChars: parts.omittedChars,
        savedChars,
        originalTokens,
        compressedTokens,
        savedTokens,
        tokenCompressionRatio: originalTokens > 0 ? compressedTokens / originalTokens : 1,
      },
    );
  }

  private buildHeadTailContent(
    content: string,
    maxSectionChars: number,
    maxSectionTokens: number,
    strategy: string,
  ): HeadTailParts {
    let marker = this.createOmissionMarker(content.length, strategy);
    let availableContentChars = Math.max(0, maxSectionChars - marker.length);
    let budgets = this.allocateHeadTailBudgets(availableContentChars);
    let tokenBudgets = this.allocateHeadTailTokenBudgets(maxSectionTokens, marker);

    for (let attempts = 0; attempts < 12; attempts += 1) {
      const head =
        budgets.headChars > 0 && tokenBudgets.headTokens > 0
          ? this.truncateHeadToTokens(
              this.sliceHead(content, budgets.headChars),
              tokenBudgets.headTokens,
            )
          : "";
      const tail =
        budgets.tailChars > 0 && tokenBudgets.tailTokens > 0
          ? this.truncateTailToTokens(
              this.sliceTail(content, budgets.tailChars),
              tokenBudgets.tailTokens,
            )
          : "";
      const omittedChars = Math.max(0, content.length - head.length - tail.length);
      marker = this.createFittingOmissionMarker(omittedChars, strategy, maxSectionChars);
      const compressedContent = `${head}${marker}${tail}`;

      if (
        compressedContent.length <= maxSectionChars &&
        this.tokenEstimator.countText(compressedContent) <= maxSectionTokens
      ) {
        return {head, tail, marker, content: compressedContent, omittedChars};
      }

      const overflow = compressedContent.length - maxSectionChars;
      budgets = this.reduceHeadTailBudgets(budgets, Math.max(1, overflow));
      tokenBudgets = this.reduceHeadTailTokenBudgets(tokenBudgets, 1);
      availableContentChars = Math.max(0, availableContentChars - overflow);
      if (
        budgets.headChars + budgets.tailChars <= 0 &&
        tokenBudgets.headTokens + tokenBudgets.tailTokens <= 0 &&
        marker.length <= maxSectionChars &&
        this.tokenEstimator.countText(marker) <= maxSectionTokens
      ) {
        return {
          head: "",
          tail: "",
          marker,
          content: marker,
          omittedChars: content.length,
        };
      }
    }

    const markerOnly = this.createFittingOmissionMarker(
      content.length,
      strategy,
      maxSectionChars,
    );
    return {
      head: "",
      tail: "",
      marker: markerOnly,
      content: markerOnly,
      omittedChars: content.length,
    };
  }

  private allocateHeadTailTokenBudgets(
    maxSectionTokens: number,
    marker: string,
  ): {
    headTokens: number;
    tailTokens: number;
  } {
    const availableTokens = Math.max(
      0,
      maxSectionTokens - this.tokenEstimator.countText(marker),
    );
    if (availableTokens <= 0) {
      return {headTokens: 0, tailTokens: 0};
    }

    const ratioTotal = this.headTokenRatio + this.tailTokenRatio;
    const headRatio = ratioTotal > 0 ? this.headTokenRatio / ratioTotal : 0.67;
    const headTokens = Math.floor(availableTokens * headRatio);

    return {
      headTokens,
      tailTokens: Math.max(0, availableTokens - headTokens),
    };
  }

  private allocateHeadTailBudgets(availableContentChars: number): {
    headChars: number;
    tailChars: number;
  } {
    if (availableContentChars <= 0) {
      return {headChars: 0, tailChars: 0};
    }

    let configuredHeadChars = this.headChars;
    let configuredTailChars = this.tailChars;

    if (configuredHeadChars + configuredTailChars === 0) {
      configuredHeadChars = Math.ceil(availableContentChars * 0.67);
      configuredTailChars = availableContentChars - configuredHeadChars;
    }

    const totalConfiguredChars = configuredHeadChars + configuredTailChars;
    if (totalConfiguredChars <= availableContentChars) {
      return {
        headChars: configuredHeadChars,
        tailChars: configuredTailChars,
      };
    }

    const headChars =
      configuredHeadChars === 0
        ? 0
        : Math.floor(
            (availableContentChars * configuredHeadChars) / totalConfiguredChars,
          );

    return {
      headChars,
      tailChars: Math.max(0, availableContentChars - headChars),
    };
  }

  private sliceHead(content: string, maxChars: number): string {
    return this.preserveLineBoundaries
      ? this.sliceHeadPreservingLines(content, maxChars)
      : content.slice(0, maxChars);
  }

  private sliceTail(content: string, maxChars: number): string {
    return this.preserveLineBoundaries
      ? this.sliceTailPreservingLines(content, maxChars)
      : content.slice(-maxChars);
  }

  private truncateHeadToTokens(content: string, maxTokens: number): string {
    if (!content || maxTokens <= 0) {
      return "";
    }

    if (this.tokenEstimator.countText(content) <= maxTokens) {
      return content;
    }

    let low = 0;
    let high = content.length;
    let best = "";

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = content.slice(0, mid);
      if (this.tokenEstimator.countText(candidate) <= maxTokens) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return this.preserveLineBoundaries
      ? this.sliceHeadPreservingLines(best, best.length)
      : best;
  }

  private truncateTailToTokens(content: string, maxTokens: number): string {
    if (!content || maxTokens <= 0) {
      return "";
    }

    if (this.tokenEstimator.countText(content) <= maxTokens) {
      return content;
    }

    let low = 0;
    let high = content.length;
    let best = "";

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = content.slice(content.length - mid);
      if (this.tokenEstimator.countText(candidate) <= maxTokens) {
        best = candidate;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return this.preserveLineBoundaries
      ? this.sliceTailPreservingLines(best, best.length)
      : best;
  }

  private createOmissionMarker(omittedChars: number, strategy: string): string {
    return `\n\n[...${omittedChars} chars omitted by ${strategy} compressor...]\n\n`;
  }

  private createFittingOmissionMarker(
    omittedChars: number,
    strategy: string,
    maxChars: number,
  ): string {
    const fullMarker = this.createOmissionMarker(omittedChars, strategy);
    if (fullMarker.length <= maxChars) {
      return fullMarker;
    }

    const compactMarker = `\n\n[...${omittedChars} chars omitted...]\n\n`;
    if (compactMarker.length <= maxChars) {
      return compactMarker;
    }

    const minimalMarker = "[...omitted...]";
    if (minimalMarker.length <= maxChars) {
      return minimalMarker;
    }

    return ".".repeat(Math.max(0, maxChars));
  }

  private sliceHeadPreservingLines(content: string, maxChars: number): string {
    const sliced = content.slice(0, Math.max(1, maxChars));
    const lastNewline = sliced.lastIndexOf("\n");

    if (lastNewline > 0) {
      const linePreserved = sliced.slice(0, lastNewline + 1);
      if (linePreserved.length >= Math.ceil(maxChars * 0.5)) {
        return linePreserved;
      }
    }

    return sliced;
  }

  private sliceTailPreservingLines(content: string, maxChars: number): string {
    const sliced = content.slice(-Math.max(1, maxChars));
    const firstNewline = sliced.indexOf("\n");

    if (firstNewline >= 0 && firstNewline < sliced.length - 1) {
      const linePreserved = sliced.slice(firstNewline + 1);
      if (linePreserved.length >= Math.ceil(maxChars * 0.5)) {
        return linePreserved;
      }
    }

    return sliced;
  }

  private reduceHeadTailBudgets(
    budgets: {headChars: number; tailChars: number},
    overflow: number,
  ): {headChars: number; tailChars: number} {
    let remainingOverflow = Math.max(1, overflow);
    const tailReduction = Math.min(budgets.tailChars, remainingOverflow);
    remainingOverflow -= tailReduction;

    return {
      headChars: Math.max(0, budgets.headChars - remainingOverflow),
      tailChars: budgets.tailChars - tailReduction,
    };
  }

  private reduceHeadTailTokenBudgets(
    budgets: {headTokens: number; tailTokens: number},
    overflow: number,
  ): {headTokens: number; tailTokens: number} {
    let remainingOverflow = Math.max(1, overflow);
    const tailReduction = Math.min(budgets.tailTokens, remainingOverflow);
    remainingOverflow -= tailReduction;

    return {
      headTokens: Math.max(0, budgets.headTokens - remainingOverflow),
      tailTokens: budgets.tailTokens - tailReduction,
    };
  }

  private positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
    if (value === undefined || !Number.isFinite(value) || value <= 0) {
      return fallback;
    }

    return Math.floor(value);
  }

  private nonNegativeIntegerOrDefault(
    value: number | undefined,
    fallback: number,
  ): number {
    if (value === undefined || !Number.isFinite(value) || value < 0) {
      return fallback;
    }

    return Math.floor(value);
  }

  private clampInteger(value: number, min: number, max: number): number {
    return Math.floor(this.clampNumber(value, min, max));
  }

  private clampNumber(value: number, min: number, max: number): number {
    if (!Number.isFinite(value)) {
      return min;
    }

    return Math.min(max, Math.max(min, value));
  }
}

export function isCompressibleSection(section: ContextSection): boolean {
  return section.source?.kind === "tool" || section.source?.kind === "file";
}

export function createCompressionResult(
  section: ContextSection,
  originalSection: ContextSection,
  compressed: boolean,
  reason?: string,
  metadata: ContextCompressionMetadata = {},
): ContextCompressionResult {
  const factory = new ContextCompressionResultFactory();
  if (compressed) {
    return factory.compressed(section, originalSection, reason ?? "", metadata);
  }

  return factory.unchanged(section, reason ?? "", metadata);
}
