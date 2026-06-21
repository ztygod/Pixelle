import {DefaultContextBudgetPolicy} from "./context-budget.js";
import {formatContextSection} from "./context-formatter.js";
import {createDefaultTokenEstimator, type TokenEstimator} from "./token-estimator.js";
import type {ContextBudget, ContextSection, ContextSectionUsage} from "./types.js";

export type FormattedContextSection = {
  section: ContextSection;
  text: string;
};

export type TruncateContextResult = {
  contextText: string;
  includedSections: ContextSection[];
  partialSections: ContextSection[];
  droppedSections: ContextSection[];
  sectionUsages: ContextSectionUsage[];
};

/** Truncates formatted context blocks to the runtime context budget. */
export class ContextTruncator {
  private readonly tokenEstimator: TokenEstimator;

  constructor(options: {tokenEstimator?: TokenEstimator} = {}) {
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();
  }

  truncate(
    sections: readonly ContextSection[],
    budget: ContextBudget,
  ): TruncateContextResult {
    return this.truncateFormatted(
      sections
        .map((section) => ({section, text: formatContextSection(section)}))
        .filter((block) => block.text.length > 0),
      budget,
    );
  }

  truncateFormatted(
    blocks: readonly FormattedContextSection[],
    budget: ContextBudget,
  ): TruncateContextResult {
    let remaining = budget.maxInputTokens;
    const selectedBlocks: string[] = [];
    const includedSections: ContextSection[] = [];
    const partialSections: ContextSection[] = [];
    const droppedSections: ContextSection[] = [];
    const sectionUsages: ContextSectionUsage[] = [];

    for (const block of blocks) {
      const separatorText = selectedBlocks.length ? "\n\n" : "";
      const separatorTokens = this.tokenEstimator.countText(separatorText);
      const allowed = remaining - separatorTokens;
      const blockTokens = this.tokenEstimator.countText(block.text);

      if (remaining <= 0 || allowed <= 0) {
        droppedSections.push(block.section);
        sectionUsages.push(
          this.createUsage(
            block,
            "dropped",
            0,
            blockTokens,
            "No remaining context budget for this section.",
          ),
        );
        remaining = 0;
        continue;
      }

      if (blockTokens > allowed) {
        const partialText = truncateTextToTokens(
          block.text,
          allowed,
          this.tokenEstimator,
        );
        const partialTokens = this.tokenEstimator.countText(partialText);

        if (!partialText) {
          droppedSections.push(block.section);
          sectionUsages.push(
            this.createUsage(
              block,
              "dropped",
              0,
              blockTokens,
              "No remaining context budget for this section.",
            ),
          );
          remaining = 0;
          continue;
        }

        selectedBlocks.push(partialText);
        partialSections.push(block.section);
        droppedSections.push(block.section);
        sectionUsages.push(
          this.createUsage(
            block,
            "partial",
            partialText.length,
            blockTokens,
            "Section exceeded the remaining context budget and was partially included.",
            partialTokens,
          ),
        );
        remaining = 0;
        continue;
      }

      selectedBlocks.push(block.text);
      includedSections.push(block.section);
      sectionUsages.push(
        this.createUsage(
          block,
          "included",
          block.text.length,
          blockTokens,
          "Section fits within the remaining context budget.",
          blockTokens,
        ),
      );
      remaining -= blockTokens + separatorTokens;
    }

    return {
      contextText: selectedBlocks.join("\n\n"),
      includedSections,
      partialSections,
      droppedSections,
      sectionUsages,
    };
  }

  private createUsage(
    block: FormattedContextSection,
    status: ContextSectionUsage["status"],
    includedLength: number,
    formattedTokens: number,
    reason: string,
    includedTokens = 0,
  ): ContextSectionUsage {
    return {
      section: block.section,
      status,
      originalLength: block.section.content.length,
      includedLength,
      formattedLength: block.text.length,
      originalTokens: this.tokenEstimator.countText(block.section.content),
      includedTokens,
      formattedTokens,
      reason,
    };
  }
}

/** Compatibility function for callers that still pass formatted blocks and a token limit. */
export function truncateContext(
  blocks: readonly FormattedContextSection[],
  tokenLimit: number,
): TruncateContextResult {
  return new ContextTruncator().truncateFormatted(
    blocks,
    new DefaultContextBudgetPolicy().createBudget({
      sections: blocks.map((block) => block.section),
      tokenLimit,
    }),
  );
}

export function truncateTextToTokens(
  text: string,
  maxTokens: number,
  tokenEstimator: TokenEstimator = createDefaultTokenEstimator(),
): string {
  if (!text || maxTokens <= 0) {
    return "";
  }

  if (tokenEstimator.countText(text) <= maxTokens) {
    return text;
  }

  let low = 0;
  let high = text.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(0, mid);
    if (tokenEstimator.countText(candidate) <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  if (!best) {
    return "";
  }

  const linePreserved = trimToLineBoundary(best);
  if (
    linePreserved.length >= Math.ceil(best.length * 0.5) &&
    tokenEstimator.countText(linePreserved) <= maxTokens
  ) {
    return linePreserved;
  }

  return best;
}

function trimToLineBoundary(text: string): string {
  const lastNewline = text.lastIndexOf("\n");
  if (lastNewline > 0) {
    return text.slice(0, lastNewline + 1);
  }

  return text;
}
