// Layer 1: collection
export {ContextCollector} from "./collector/context-collector.js";
export type {
  CollectContextOptions,
  ContextCollectorOptions,
} from "./collector/context-collector.js";
export {ContextPipeline, createDefaultContextPipeline} from "./context-pipeline.js";
export type {
  ContextPipelineBuildInput,
  ContextPipelineBuildResult,
  ContextPipelineLike,
  ContextPipelineOptions,
  DefaultContextPipelineOptions,
} from "./context-pipeline.js";

// Layer 2: transcript projection
export {TranscriptProjector} from "./transcript/transcript-projector.js";

// Layer 3: budgeting and compression
export {ContextBudgeter} from "./budget/context-budgeter.js";
export {ContextWindowExceededError} from "./errors.js";
export type {ContextWindowBreakdown} from "./errors.js";
export {
  ModelTranscriptSummarizer,
  TranscriptBudgeter,
} from "./transcript/transcript-budgeter.js";
export type {
  TranscriptSummarizer,
  TranscriptSummaryInput,
  TranscriptBudgetResult,
} from "./transcript/transcript-budgeter.js";
export type {ContextBudgeterOptions} from "./budget/context-budgeter.js";
export {DefaultContextBudgetPolicy} from "./budget/context-budget.js";
export type {ContextBudgetInput, ContextBudgetPolicy} from "./budget/context-budget.js";
export {estimateRequestTokens} from "./budget/token-estimator.js";
export type {RequestTokenEstimate} from "./budget/token-estimator.js";
export {DefaultContextPriorityPolicy} from "./budget/priority-policy.js";
export type {ContextPriorityPolicy} from "./budget/priority-policy.js";
export {
  ApproxTokenEstimator,
  createDefaultTokenEstimator,
  GptTokenEstimator,
} from "./budget/token-estimator.js";
export type {TokenCountableMessage, TokenEstimator} from "./budget/token-estimator.js";
export {ContextCompressionPipeline} from "./budget/compression-pipeline.js";
export type {
  ContextCompressionPipelineOptions,
  ContextCompressionPipelineResult,
} from "./budget/compression-pipeline.js";
export {
  ContextCompressionResultFactory,
  isCompressibleSection,
  RuleBasedContextCompressor,
} from "./budget/compressor.js";
export type {
  ContextCompressor,
  ContextCompressionMetadata,
  RuleBasedContextCompressorOptions,
} from "./budget/compressor.js";
export {ContextTruncator, truncateTextToTokens} from "./budget/truncator.js";
export type {TruncateContextResult} from "./budget/truncator.js";

// Layer 4: prompt assembly
export {formatContextSection} from "./assembly/context-formatter.js";
export {PromptAssembler} from "./assembly/prompt-assembler.js";

// Shared contracts
export type {
  BudgetedContext,
  BuildContextDiagnostics,
  ContextBudget,
  ContextCompressionResult,
  ContextDocument,
  ContextDocumentMetadata,
  ContextRetention,
  ContextSection,
  ContextSectionUsage,
  ContextSectionUsageStatus,
  ContextSource,
  TranscriptProjection,
} from "./types.js";
