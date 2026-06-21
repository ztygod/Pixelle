import type {ContextCompressionPipeline} from "./context-compression-pipeline.js";
import type {ContextBudgetPolicy} from "./context-budget.js";
import type {ContextCompressor} from "./context-compressor.js";
import type {ContextTruncator} from "./context-truncator.js";
import type {ContextPriorityPolicy} from "./priority-policy.js";
import type {SystemPromptAssembler} from "./system-prompt-assembler.js";

/** Source metadata for a context section. */
export type ContextSource =
  | {kind: "system"; ref?: string}
  | {kind: "workspace"; ref?: string}
  | {kind: "memory"; ref?: string}
  | {kind: "provider"; ref?: string}
  | {kind: "user"; ref?: string}
  | {kind: "tool"; ref?: string}
  | {kind: "file"; ref?: string};

/** A model-visible runtime context block. */
export type ContextSection = {
  id?: string;
  replaceKey?: string;
  title?: string;
  content: string;
  priority?: number;
  source?: ContextSource;
};

/** Input accepted by the generic runtime context builder. */
export type BuildContextInput = {
  systemPrompt?: string;
  outputInstructions?: string;
  sections: readonly ContextSection[];
  tokenLimit: number;
};

/** Result returned after formatting and truncating runtime context. */
export type BuildContextResult = {
  systemPrompt: string;
  contextText: string;
  tokenEstimate: number;
  includedSections: ContextSection[];
  partialSections: ContextSection[];
  droppedSections: ContextSection[];
  sectionUsages: ContextSectionUsage[];
  diagnostics?: BuildContextDiagnostics;
};

/** Runtime context budget derived from the model token limit. */
export type ContextBudget = {
  tokenLimit: number;
  runtimeContextRatio: number;
  maxContextChars: number;
};

/** Explicit section-level truncation status. */
export type ContextSectionUsageStatus = "included" | "partial" | "dropped";

/** Truncation and injection details for a single context section. */
export type ContextSectionUsage = {
  section: ContextSection;
  status: ContextSectionUsageStatus;
  originalLength: number;
  includedLength: number;
  formattedLength: number;
  reason?: string;
};

/** Result returned by a context compressor. */
export type ContextCompressionResult = {
  section: ContextSection;
  originalSection: ContextSection;
  compressed: boolean;
  originalChars: number;
  compressedChars: number;
  strategy?: string;
  omittedChars?: number;
  savedChars?: number;
  compressionRatio?: number;
  maxSectionChars?: number;
  reason?: string;
};

/** Diagnostics produced while building runtime context. */
export type BuildContextDiagnostics = {
  budget: ContextBudget;
  estimatedContextChars: number;
  compressionThresholdRatio: number;
  compressionTriggered: boolean;
  compressionResults: ContextCompressionResult[];
  contextTextTokens: number;
  systemPromptTokens: number;
};

/** Optional strategy overrides for the class-based context engine. */
export type ContextEngineOptions = {
  priorityPolicy?: ContextPriorityPolicy;
  budgetPolicy?: ContextBudgetPolicy;
  compressionPipeline?: ContextCompressionPipeline;
  compressor?: ContextCompressor;
  compressionThresholdRatio?: number;
  truncator?: ContextTruncator;
  assembler?: SystemPromptAssembler;
};
