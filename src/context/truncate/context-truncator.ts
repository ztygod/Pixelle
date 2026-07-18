import {
  createDefaultTokenEstimator,
  type TokenEstimator,
} from "../budget/token-estimator.js";
import {formatContextSection} from "../assembler/context-formatter.js";
import type {ContextBudget, ContextSection, ContextSectionUsage} from "../types.js";

export type FormattedContextSection = {
  section: ContextSection;
  text: string;
};

export type TruncateContextResult = {
  contextText: string;
  includedSections: ContextSection[];
  partiallyIncludedSections: ContextSection[];
  omittedSections: ContextSection[];
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
    // Format once, then truncate the exact text that will be inserted.
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
    // Only runtime context can spend this budget; prompt/history/tool costs are pre-deducted.
    let remaining = budget.runtimeContextTokens;
    const selectedBlocks: string[] = [];
    const includedSections: ContextSection[] = [];
    const partiallyIncludedSections: ContextSection[] = [];
    const omittedSections: ContextSection[] = [];
    const sectionUsages: ContextSectionUsage[] = [];

    for (const block of blocks) {
      const separatorText = selectedBlocks.length ? "\n\n" : "";
      const separatorTokens = this.tokenEstimator.countText(separatorText);
      const allowed = remaining - separatorTokens;
      const blockTokens = this.tokenEstimator.countText(block.text);

      if (remaining <= 0 || allowed <= 0) {
        // Required sections are allowed through; final validation catches true overflow.
        if (block.section.required) {
          selectedBlocks.push(block.text);
          includedSections.push(block.section);
          sectionUsages.push(
            this.createUsage(
              block,
              "included",
              block.text.length,
              blockTokens,
              "Required section was included even though it exceeded the remaining runtime context budget.",
              blockTokens,
            ),
          );
          remaining -= blockTokens + separatorTokens;
          continue;
        }

        omittedSections.push(block.section);
        sectionUsages.push(
          this.createUsage(
            block,
            "omitted",
            0,
            blockTokens,
            "No remaining context budget for this section.",
          ),
        );
        remaining = 0;
        continue;
      }

      if (blockTokens > allowed) {
        // Non-truncatable sections are either included whole if required or omitted.
        if (block.section.truncation === "none") {
          if (block.section.required) {
            selectedBlocks.push(block.text);
            includedSections.push(block.section);
            sectionUsages.push(
              this.createUsage(
                block,
                "included",
                block.text.length,
                blockTokens,
                "Required section disallows truncation and was included in full.",
                blockTokens,
              ),
            );
            remaining -= blockTokens + separatorTokens;
            continue;
          }

          omittedSections.push(block.section);
          sectionUsages.push(
            this.createUsage(
              block,
              "omitted",
              0,
              blockTokens,
              "Section exceeded the remaining context budget and disallows truncation.",
            ),
          );
          remaining = Math.max(0, remaining);
          continue;
        }

        // Strategy controls which part of an oversized section is preserved.
        const partialText = truncateTextToTokens(
          block.text,
          allowed,
          block.section.truncation,
          this.tokenEstimator,
        );
        const partialTokens = this.tokenEstimator.countText(partialText);

        if (!partialText) {
          if (block.section.required) {
            selectedBlocks.push(block.text);
            includedSections.push(block.section);
            sectionUsages.push(
              this.createUsage(
                block,
                "included",
                block.text.length,
                blockTokens,
                "Required section could not be partially truncated and was included in full.",
                blockTokens,
              ),
            );
            remaining -= blockTokens + separatorTokens;
            continue;
          }

          omittedSections.push(block.section);
          sectionUsages.push(
            this.createUsage(
              block,
              "omitted",
              0,
              blockTokens,
              "No remaining context budget for this section.",
            ),
          );
          remaining = 0;
          continue;
        }

        selectedBlocks.push(partialText);
        partiallyIncludedSections.push(block.section);
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
      partiallyIncludedSections,
      omittedSections,
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

export function truncateTextToTokens(
  text: string,
  maxTokens: number,
  strategyOrEstimator: ContextSection["truncation"] | TokenEstimator = "head",
  tokenEstimator: TokenEstimator = createDefaultTokenEstimator(),
): string {
  const strategy = typeof strategyOrEstimator === "string" ? strategyOrEstimator : "head";
  const estimator =
    typeof strategyOrEstimator === "string" ? tokenEstimator : strategyOrEstimator;

  if (!text || maxTokens <= 0) {
    return "";
  }

  if (estimator.countText(text) <= maxTokens) {
    return text;
  }

  if (strategy === "tail") {
    return truncateTailTextToTokens(text, maxTokens, estimator);
  }

  if (strategy === "middle" || strategy === "semantic") {
    return truncateMiddleTextToTokens(text, maxTokens, estimator);
  }

  return truncateHeadTextToTokens(text, maxTokens, estimator);
}

function truncateHeadTextToTokens(
  text: string,
  maxTokens: number,
  tokenEstimator: TokenEstimator,
): string {
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

function truncateTailTextToTokens(
  text: string,
  maxTokens: number,
  tokenEstimator: TokenEstimator,
): string {
  let low = 0;
  let high = text.length;
  let best = "";

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = text.slice(text.length - mid);
    if (tokenEstimator.countText(candidate) <= maxTokens) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return best;
}

function truncateMiddleTextToTokens(
  text: string,
  maxTokens: number,
  tokenEstimator: TokenEstimator,
): string {
  if (maxTokens <= 0) {
    return "";
  }

  const marker = "\n[...context omitted...]\n";
  const markerTokens = tokenEstimator.countText(marker);
  if (markerTokens >= maxTokens) {
    return truncateHeadTextToTokens(text, maxTokens, tokenEstimator);
  }

  const sideBudget = Math.floor((maxTokens - markerTokens) / 2);
  const head = truncateHeadTextToTokens(text, sideBudget, tokenEstimator);
  const tail = truncateTailTextToTokens(
    text,
    maxTokens - markerTokens - tokenEstimator.countText(head),
    tokenEstimator,
  );
  const candidate = `${head}${marker}${tail}`;

  return tokenEstimator.countText(candidate) <= maxTokens
    ? candidate
    : truncateHeadTextToTokens(text, maxTokens, tokenEstimator);
}

function trimToLineBoundary(text: string): string {
  const lastNewline = text.lastIndexOf("\n");
  if (lastNewline > 0) {
    return text.slice(0, lastNewline + 1);
  }

  return text;
}
