import type {ResolvedSystemPrompt} from "../agent/prompt/index.js";
import {LLMClient, type BaseLLMClient} from "../llm/index.js";
import type {LLMClientConfig} from "../config/index.js";
import type {LLMGenerateInput, LLMTool} from "../llm/types.js";
import {PromptAssembler} from "./assembly/prompt-assembler.js";
import {ContextBudgeter} from "./budget/context-budgeter.js";
import {ContextCompressionPipeline} from "./budget/compression-pipeline.js";
import {RuleBasedContextCompressor} from "./budget/compressor.js";
import {
  createDefaultTokenEstimator,
  estimateRequestTokens,
  type TokenEstimator,
} from "./budget/token-estimator.js";
import {ContextTruncator} from "./budget/truncator.js";
import {ContextWindowExceededError} from "./errors.js";
import {
  ModelTranscriptSummarizer,
  TranscriptBudgeter,
  type TranscriptSummarizer,
} from "./transcript/transcript-budgeter.js";
import {TranscriptProjector} from "./transcript/transcript-projector.js";
import type {BuildContextDiagnostics, ContextDocument} from "./types.js";

export type ContextPipelineBuildInput = {
  document: ContextDocument;
  resolvedSystemPrompt: ResolvedSystemPrompt;
  tools?: readonly LLMTool[];
  tokenLimit: number;
};

export type ContextPipelineBuildResult = {
  request: LLMGenerateInput;
  diagnostics: BuildContextDiagnostics;
  compacted: boolean;
};

export interface ContextPipelineLike {
  build(input: ContextPipelineBuildInput): Promise<ContextPipelineBuildResult>;
}

/**
 * Advanced composition options for the context build algorithm.
 *
 * Allows replacing individual pipeline stages with custom implementations.
 */
export type ContextPipelineOptions = {
  transcriptProjector?: TranscriptProjector;
  transcriptBudgeter?: TranscriptBudgeter;
  tokenEstimator?: TokenEstimator;
  budgeter?: ContextBudgeter;
  compressionPipeline?: ContextCompressionPipeline;
  truncator?: ContextTruncator;
  promptAssembler?: PromptAssembler;
};

export type DefaultContextPipelineOptions = ContextPipelineOptions & {
  transcriptSummarizer?: TranscriptSummarizer;
  llm?: BaseLLMClient;
  llmConfig?: LLMClientConfig;
};

/**
 * Coordinates the context construction pipeline before an LLM request.
 *
 * The pipeline is responsible for:
 *
 * 1. Projecting internal transcripts into model-compatible messages.
 * 2. Calculating token budgets and allocating context space.
 * 3. Compacting conversation history when necessary.
 * 4. Compressing context sections to reduce token usage.
 * 5. Truncating low-priority context when limits are exceeded.
 * 6. Assembling the final system prompt and message list.
 * 7. Estimating final request size.
 * 8. Producing diagnostics for observability.
 * 9. Enforcing model context window constraints.
 *
 * ContextManager should only coordinate this pipeline and should not
 * depend on individual optimization strategies.
 */
export class ContextPipeline implements ContextPipelineLike {
  private readonly transcriptProjector: TranscriptProjector;
  private readonly transcriptBudgeter: TranscriptBudgeter;
  private readonly tokenEstimator: TokenEstimator;
  private readonly budgeter: ContextBudgeter;
  private readonly compressionPipeline: ContextCompressionPipeline;
  private readonly truncator: ContextTruncator;
  private readonly promptAssembler: PromptAssembler;

  constructor(options: ContextPipelineOptions = {}) {
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();

    this.transcriptProjector = options.transcriptProjector ?? new TranscriptProjector();

    this.transcriptBudgeter =
      options.transcriptBudgeter ??
      new TranscriptBudgeter({
        tokenEstimator: this.tokenEstimator,
      });

    this.budgeter =
      options.budgeter ??
      new ContextBudgeter({
        tokenEstimator: this.tokenEstimator,
      });

    this.compressionPipeline =
      options.compressionPipeline ??
      new ContextCompressionPipeline({
        compressor: new RuleBasedContextCompressor({
          tokenEstimator: this.tokenEstimator,
        }),
        tokenEstimator: this.tokenEstimator,
      });

    this.truncator =
      options.truncator ??
      new ContextTruncator({
        tokenEstimator: this.tokenEstimator,
      });

    this.promptAssembler = options.promptAssembler ?? new PromptAssembler();
  }

  /** Executes the complete context build and validates the final request budget. */
  async build(input: ContextPipelineBuildInput): Promise<ContextPipelineBuildResult> {
    const tools = input.tools ?? [];
    let projection = this.transcriptProjector.project(input.document.transcript);
    const baseSystemPrompt = input.resolvedSystemPrompt.content;
    let budgeted = this.budgeter.budget(
      input.document,
      projection,
      input.tokenLimit,
      baseSystemPrompt,
      tools,
    );

    const fixedOverflow = Math.max(
      0,
      budgeted.budget.estimatedTotalInputTokens -
        budgeted.diagnostics.estimatedContextTokens -
        budgeted.budget.hardInputLimit,
    );

    let transcriptResult = {
      messages: projection.messages,
      tokensBefore: budgeted.budget.transcriptTokens,
      tokensAfter: budgeted.budget.transcriptTokens,
      summarizedMessageCount: 0,
    };

    if (fixedOverflow > 0) {
      transcriptResult = await this.transcriptBudgeter.compact(
        projection.messages,
        Math.max(0, budgeted.budget.transcriptTokens - fixedOverflow),
      );

      projection = {
        ...projection,
        messages: transcriptResult.messages,
      };

      budgeted = this.budgeter.budget(
        input.document,
        projection,
        input.tokenLimit,
        baseSystemPrompt,
        tools,
      );
    }

    const compression = this.compressionPipeline.process(budgeted);
    const truncation = this.truncator.truncate(compression.sections, budgeted.budget);
    const systemPrompt = this.promptAssembler.assembleSystemPrompt(
      input.resolvedSystemPrompt,
      truncation.contextText,
    );

    const messages = this.promptAssembler.assembleWithSystemPrompt(
      systemPrompt,
      projection,
    );

    const finalEstimate = estimateRequestTokens(this.tokenEstimator, messages, tools);

    const sectionTokens = this.tokenEstimator.countText(truncation.contextText);

    const finalBudget = {
      ...budgeted.budget,
      sectionTokens,
      estimatedTotalInputTokens: finalEstimate.totalTokens,
      estimatedTotalRequestTokens:
        finalEstimate.totalTokens +
        budgeted.budget.reservedOutputTokens +
        budgeted.budget.safetyMarginTokens,
    };

    const diagnostics: BuildContextDiagnostics = {
      stage: input.document.metadata.stage,
      budget: finalBudget,
      estimatedContextChars: compression.estimatedContextChars,
      estimatedContextTokens: compression.estimatedContextTokens,
      compressionThresholdRatio: compression.thresholdRatio,
      compressionTriggered: compression.triggered,
      compressionLimitTokens: compression.compressionLimitTokens,
      compressionResults: compression.results,
      contextTextTokens: sectionTokens,
      systemPromptVersion: input.resolvedSystemPrompt.version,
      systemPromptTokens: this.tokenEstimator.countText(systemPrompt),
      systemPromptSectionTokens: input.resolvedSystemPrompt.sections.map((section) => ({
        id: section.id,
        tokens: this.tokenEstimator.countText(`# ${section.title}\n${section.content}`),
      })),
      transcriptTokensBefore: transcriptResult.tokensBefore,
      transcriptTokensAfter: transcriptResult.tokensAfter,
      toolSchemaTokens: finalBudget.toolSchemaTokens,
      requestOverheadTokens: finalEstimate.overheadTokens,
      safetyMarginTokens: finalBudget.safetyMarginTokens,
      estimatedTotalInputTokens: finalEstimate.totalTokens,
      finalHeadroomTokens: finalBudget.hardInputLimit - finalEstimate.totalTokens,
      archivedToolExchangeCount: projection.archivedSections.length,
      summarizedMessageCount: transcriptResult.summarizedMessageCount,
      droppedSectionCount: truncation.droppedSections.length,
    };

    if (finalEstimate.totalTokens > finalBudget.hardInputLimit) {
      throw new ContextWindowExceededError(
        "Model request cannot fit the configured context window after safe compaction.",
        {
          tokenLimit: finalBudget.maxContextTokens,
          hardInputLimit: finalBudget.hardInputLimit,
          systemPromptTokens: finalBudget.systemPromptTokens,
          transcriptTokens: finalBudget.transcriptTokens,
          toolSchemaTokens: finalBudget.toolSchemaTokens,
          requestOverheadTokens: finalEstimate.overheadTokens,
          sectionTokens,
        },
        diagnostics,
      );
    }

    return {
      request: {
        messages,
        tools,
      },
      diagnostics,
      compacted:
        transcriptResult.summarizedMessageCount > 0 ||
        truncation.droppedSections.length > 0,
    };
  }
}

/**
 * Creates a default context pipeline with shared dependencies.
 *
 * All internal stages share the same TokenEstimator to ensure
 * consistent token calculation across budgeting, compression,
 * truncation, and validation.
 */
export function createDefaultContextPipeline(
  options: DefaultContextPipelineOptions = {},
): ContextPipeline {
  const {transcriptSummarizer, llm, llmConfig, ...pipelineOptions} = options;
  const tokenEstimator = pipelineOptions.tokenEstimator ?? createDefaultTokenEstimator();

  const summaryClient = llm ?? (llmConfig ? new LLMClient(llmConfig) : undefined);

  const resolvedTranscriptSummarizer =
    transcriptSummarizer ??
    (summaryClient ? new ModelTranscriptSummarizer(summaryClient) : undefined);

  const transcriptBudgeter =
    pipelineOptions.transcriptBudgeter ??
    new TranscriptBudgeter({
      tokenEstimator,
      summarizer: resolvedTranscriptSummarizer,
    });

  return new ContextPipeline({
    ...pipelineOptions,
    tokenEstimator,
    transcriptBudgeter,
  });
}
