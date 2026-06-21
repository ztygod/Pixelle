import {DefaultContextBudgetPolicy} from "./context-budget.js";
import {formatContextSection} from "./context-formatter.js";
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
    let remaining = budget.maxContextChars;
    const selectedBlocks: string[] = [];
    const includedSections: ContextSection[] = [];
    const partialSections: ContextSection[] = [];
    const droppedSections: ContextSection[] = [];
    const sectionUsages: ContextSectionUsage[] = [];

    for (const block of blocks) {
      const separatorLength = selectedBlocks.length ? 2 : 0;
      const allowed = remaining - separatorLength;

      if (remaining <= 0 || allowed <= 0) {
        droppedSections.push(block.section);
        sectionUsages.push(createUsage(block, "dropped", 0));
        remaining = 0;
        continue;
      }

      if (block.text.length > allowed) {
        selectedBlocks.push(block.text.slice(0, allowed));
        partialSections.push(block.section);
        droppedSections.push(block.section);
        sectionUsages.push(createUsage(block, "partial", allowed));
        remaining = 0;
        continue;
      }

      selectedBlocks.push(block.text);
      includedSections.push(block.section);
      sectionUsages.push(createUsage(block, "included", block.text.length));
      remaining -= block.text.length + separatorLength;
    }

    return {
      contextText: selectedBlocks.join("\n\n"),
      includedSections,
      partialSections,
      droppedSections,
      sectionUsages,
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

function createUsage(
  block: FormattedContextSection,
  status: ContextSectionUsage["status"],
  includedLength: number,
): ContextSectionUsage {
  return {
    section: block.section,
    status,
    originalLength: block.section.content.length,
    includedLength,
    formattedLength: block.text.length,
  };
}
