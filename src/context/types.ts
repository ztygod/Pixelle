import type {ContextBudgetPolicy} from "./budget/context-budget.js";
import type {ContextPriorityPolicy} from "./budget/priority-policy.js";
import type {TokenCountableMessage, TokenEstimator} from "./budget/token-estimator.js";
import type {ContextCompressionPipeline} from "./compression/context-compression-pipeline.js";
import type {ContextCompressor} from "./compression/context-compressor.js";
import type {ContextTruncator} from "./truncate/context-truncator.js";
import type {SystemPromptAssembler} from "./assembler/system-prompt-assembler.js";

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
  required?: boolean;
  pinned?: boolean;
  compressible?: boolean;
  truncation?: ContextSectionTruncation;
  metadata?: Record<string, unknown>;
};

export type ContextSectionTruncation = "none" | "head" | "tail" | "middle" | "semantic";

/** Input accepted by the generic runtime context builder. */
export type BuildContextInput = {
  // Base system prompt before output instructions and runtime context are appended.
  baseSystemPrompt?: string;
  outputInstructions?: string;
  sections: readonly ContextSection[];
  tokenLimit: number;
  conversationMessages?: readonly TokenCountableMessage[];
  toolSchemas?: readonly unknown[];
  conversationTokens?: number;
  toolSchemaTokens?: number;
  safetyMarginTokens?: number;
};

/** Result returned after formatting and truncating runtime context. */
export type BuildContextResult = {
  // Final system message content after assembling base prompt, output rules, and runtime context.
  assembledSystemPrompt: string;
  contextText: string;
  tokenEstimate: number;
  includedSections: ContextSection[];
  partiallyIncludedSections: ContextSection[];
  omittedSections: ContextSection[];
  sectionUsages: ContextSectionUsage[];
  diagnostics?: BuildContextDiagnostics;
};

/** Runtime context budget derived from the model token limit. */
export type ContextBudget = {
  tokenLimit: number;
  modelContextWindow: number;
  reservedOutputTokens: number;
  systemPromptTokens: number;
  outputInstructionTokens: number;
  toolSchemaTokens: number;
  conversationTokens: number;
  safetyMarginTokens: number;
  runtimeContextTokens: number;
  finalInputTokens?: number;
  remainingInputTokens?: number;
};

/** Explicit section-level truncation status. */
export type ContextSectionUsageStatus = "included" | "partial" | "omitted";

/** Truncation and injection details for a single context section. */
export type ContextSectionUsage = {
  section: ContextSection;
  status: ContextSectionUsageStatus;
  originalLength: number;
  includedLength: number;
  formattedLength: number;
  originalTokens?: number;
  includedTokens?: number;
  formattedTokens?: number;
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
  originalTokens?: number;
  compressedTokens?: number;
  savedTokens?: number;
  tokenCompressionRatio?: number;
  maxSectionTokens?: number;
  reason?: string;
};

export type ContextSectionDecision = {
  section: ContextSection;
  stage: "compression" | "truncation";
  action: "included" | "partial" | "omitted" | "compressed" | "skipped";
  reason: string;
  originalTokens?: number;
  outputTokens?: number;
  savedTokens?: number;
};

export type ContextTokenUsageDiagnostics = {
  modelContextWindow: number;
  reservedOutputTokens: number;
  systemPromptTokens: number;
  outputInstructionTokens: number;
  toolSchemaTokens: number;
  conversationTokens: number;
  safetyMarginTokens: number;
  runtimeContextTokens: number;
  contextTextTokens: number;
  finalInputTokens: number;
  remainingInputTokens: number;
};

/** Diagnostics produced while building runtime context. */
export type BuildContextDiagnostics = {
  budget: ContextBudget;
  tokenUsage: ContextTokenUsageDiagnostics;
  estimatedContextChars: number;
  estimatedContextTokens: number;
  compressionThresholdRatio: number;
  compressionTriggered: boolean;
  compressionLimitTokens: number;
  compressionResults: ContextCompressionResult[];
  contextTextTokens: number;
  systemPromptTokens: number;
  finalInputTokens: number;
  remainingInputTokens: number;
  sectionDecisions: ContextSectionDecision[];
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
  tokenEstimator?: TokenEstimator;
};
