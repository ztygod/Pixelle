import type {ContextBudget, ContextCompressionResult, ContextSection} from "./types.js";

export type ContextCompressionMetadata = {
  strategy?: string;
  maxSectionChars?: number;
  omittedChars?: number;
  savedChars?: number;
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

    return {
      section,
      originalSection,
      compressed,
      originalChars: originalSection.content.length,
      compressedChars: section.content.length,
      omittedChars,
      savedChars,
      compressionRatio,
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
  maxSectionChars?: number;
  minSectionChars?: number;
  maxSectionRatio?: number;
  headChars?: number;
  tailChars?: number;
  preserveLineBoundaries?: boolean;
};

/** Conservative compressor for oversized tool and file context sections. */
export class RuleBasedContextCompressor implements ContextCompressor {
  private readonly maxSectionChars: number;
  private readonly minSectionChars: number;
  private readonly maxSectionRatio: number;
  private readonly headChars: number;
  private readonly tailChars: number;
  private readonly preserveLineBoundaries: boolean;
  private readonly resultFactory: ContextCompressionResultFactory;

  constructor(
    options: RuleBasedContextCompressorOptions = {},
    resultFactory = new ContextCompressionResultFactory(),
  ) {
    const maxSectionChars = this.positiveIntegerOrDefault(options.maxSectionChars, 8_000);
    const minSectionChars = this.positiveIntegerOrDefault(options.minSectionChars, 1_200);

    this.maxSectionChars = maxSectionChars;
    this.minSectionChars = Math.min(minSectionChars, maxSectionChars);
    this.maxSectionRatio = this.clampNumber(options.maxSectionRatio ?? 0.25, 0.05, 1);
    this.headChars = this.nonNegativeIntegerOrDefault(options.headChars, 4_000);
    this.tailChars = this.nonNegativeIntegerOrDefault(options.tailChars, 2_000);
    this.preserveLineBoundaries = options.preserveLineBoundaries ?? true;
    this.resultFactory = resultFactory;
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
    return this.compressHeadTail(section, this.resolveMaxSectionChars(budget));
  }

  private compressFileSection(
    section: ContextSection,
    budget: ContextBudget,
  ): ContextCompressionResult {
    return this.compressHeadTail(section, this.resolveMaxSectionChars(budget));
  }

  private resolveMaxSectionChars(budget: ContextBudget): number {
    const budgetBasedLimit = Math.floor(budget.maxContextChars * this.maxSectionRatio);

    return this.clampInteger(
      Math.min(this.maxSectionChars, budgetBasedLimit),
      this.minSectionChars,
      this.maxSectionChars,
    );
  }

  private compressHeadTail(
    section: ContextSection,
    maxSectionChars: number,
  ): ContextCompressionResult {
    const strategy = "rule-based-head-tail";

    if (!section.content.trim()) {
      return this.resultFactory.unchanged(
        section,
        "Section content is empty after trimming.",
        {strategy, maxSectionChars},
      );
    }

    if (section.content.length <= maxSectionChars) {
      return this.resultFactory.unchanged(
        section,
        `Section is within the dynamic section limit (${section.content.length} <= ${maxSectionChars} chars).`,
        {strategy, maxSectionChars},
      );
    }

    const parts = this.buildHeadTailContent(section.content, maxSectionChars, strategy);

    if (!parts.content.trim() || parts.content.length >= section.content.length) {
      return this.resultFactory.unchanged(
        section,
        "Rule-based compression would not reduce this section.",
        {strategy, maxSectionChars},
      );
    }

    const compressedSection = {...section, content: parts.content};
    const savedChars = section.content.length - parts.content.length;

    return this.resultFactory.compressed(
      compressedSection,
      section,
      `Section exceeded dynamic section limit: ${section.content.length} chars -> ${parts.content.length} chars, omitted ${parts.omittedChars} original chars, saved ${savedChars} chars using rule-based-head-tail compression.`,
      {
        strategy,
        maxSectionChars,
        omittedChars: parts.omittedChars,
        savedChars,
      },
    );
  }

  private buildHeadTailContent(
    content: string,
    maxSectionChars: number,
    strategy: string,
  ): HeadTailParts {
    let marker = this.createOmissionMarker(content.length, strategy);
    let availableContentChars = Math.max(0, maxSectionChars - marker.length);
    let budgets = this.allocateHeadTailBudgets(availableContentChars);

    for (let attempts = 0; attempts < 8; attempts += 1) {
      const head =
        budgets.headChars > 0 ? this.sliceHead(content, budgets.headChars) : "";
      const tail =
        budgets.tailChars > 0 ? this.sliceTail(content, budgets.tailChars) : "";
      const omittedChars = Math.max(0, content.length - head.length - tail.length);
      marker = this.createFittingOmissionMarker(omittedChars, strategy, maxSectionChars);
      const compressedContent = `${head}${marker}${tail}`;

      if (compressedContent.length <= maxSectionChars) {
        return {head, tail, marker, content: compressedContent, omittedChars};
      }

      const overflow = compressedContent.length - maxSectionChars;
      budgets = this.reduceHeadTailBudgets(budgets, overflow);
      availableContentChars = Math.max(0, availableContentChars - overflow);
      if (
        budgets.headChars + budgets.tailChars <= 0 &&
        marker.length <= maxSectionChars
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
