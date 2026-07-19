import type {LLMMessage} from "../llm/types.js";

/** Source metadata for a context section. */
export type ContextSource =
  | {kind: "system"; ref?: string}
  | {kind: "workspace"; ref?: string}
  | {kind: "memory"; ref?: string}
  | {kind: "provider"; ref?: string}
  | {kind: "user"; ref?: string}
  | {kind: "tool"; ref?: string}
  | {kind: "file"; ref?: string}
  | {kind: "runtime"; ref?: string}
  | {kind: "verification"; ref?: string}
  | {kind: "plan"; ref?: string}
  | {kind: "git"; ref?: string};

/** Retention intent carried by a section for future budget policies. */
export type ContextRetention = "required" | "preferred" | "compressible" | "discardable";

/** A model-visible runtime context block. */
export type ContextSection = {
  id?: string;
  replaceKey?: string;
  title?: string;
  content: string;
  priority?: number;
  source?: ContextSource;
  /** Informational in the first architecture phase; current policies ignore it. */
  retention?: ContextRetention;
};

/** Stage metadata attached to a context document. */
export type ContextDocumentMetadata = {
  runId: string;
  iteration: number;
  stage: "agent" | "verification" | "repair";
};

/** Collected context before projection, budgeting, compression, or assembly. */
export type ContextDocument = {
  systemPrompt?: string;
  outputInstructions?: string;
  sections: readonly ContextSection[];
  transcript: readonly LLMMessage[];
  metadata: ContextDocumentMetadata;
};

/** Legal model transcript plus tool results projected out of older exchanges. */
export type TranscriptProjection = {
  messages: readonly LLMMessage[];
  archivedSections: readonly ContextSection[];
};

/** Runtime context budget derived from the model token limit. */
export type ContextBudget = {
  tokenLimit: number;
  maxContextTokens: number;
  reservedOutputTokens: number;
  maxInputTokens: number;
};

/** Budget decision produced before any compression strategy is executed. */
export type BudgetedContext = {
  budget: ContextBudget;
  sections: readonly ContextSection[];
  compressionRequired: boolean;
  diagnostics: {
    estimatedContextChars: number;
    estimatedContextTokens: number;
    compressionLimitTokens: number;
    compressionThresholdRatio: number;
  };
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

/** Diagnostics produced while building runtime context. */
export type BuildContextDiagnostics = {
  budget: ContextBudget;
  estimatedContextChars: number;
  estimatedContextTokens: number;
  compressionThresholdRatio: number;
  compressionTriggered: boolean;
  compressionLimitTokens: number;
  compressionResults: ContextCompressionResult[];
  contextTextTokens: number;
  systemPromptTokens: number;
};
