import {DefaultContextBudgetPolicy} from "../budget/context-budget.js";
import {DefaultContextPriorityPolicy} from "../budget/priority-policy.js";
import {
  createDefaultTokenEstimator,
  type TokenEstimator,
} from "../budget/token-estimator.js";
import {ContextCompressionPipeline} from "../compression/context-compression-pipeline.js";
import {ContextTruncator} from "../truncate/context-truncator.js";
import {SystemPromptAssembler} from "../assembler/system-prompt-assembler.js";
import type {ContextBudgetPolicy} from "../budget/context-budget.js";
import type {ContextPriorityPolicy} from "../budget/priority-policy.js";
import type {
  BuildContextInput,
  BuildContextResult,
  ContextEngineOptions,
  ContextTokenUsageDiagnostics,
} from "../types.js";
import {ContextRegistry} from "./context-registry.js";

/** Thrown when the final assembled prompt exceeds the model input budget. */
export class ContextBudgetExceededError extends Error {
  constructor(
    message: string,
    readonly tokenUsage: ContextTokenUsageDiagnostics,
  ) {
    super(message);
    this.name = "ContextBudgetExceededError";
  }
}

/**
 * Class-based context engine that owns the full runtime context pipeline.
 *
 * Pipeline:
 * sections -> registry -> budget -> compression -> truncation -> assembly -> validation
 */
export class ContextEngine {
  private readonly priorityPolicy: ContextPriorityPolicy;
  private readonly budgetPolicy: ContextBudgetPolicy;
  private readonly compressionPipeline: ContextCompressionPipeline;
  private readonly truncator: ContextTruncator;
  private readonly assembler: SystemPromptAssembler;
  private readonly tokenEstimator: TokenEstimator;

  constructor(options: ContextEngineOptions = {}) {
    // Shared token estimator used by budget, compression, truncation and diagnostics.
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();

    // Pluggable policies keep context ordering and budget calculation replaceable.
    this.priorityPolicy = options.priorityPolicy ?? new DefaultContextPriorityPolicy();
    this.budgetPolicy = options.budgetPolicy ?? new DefaultContextBudgetPolicy();

    // Compress oversized or low-value context before truncation.
    this.compressionPipeline =
      options.compressionPipeline ??
      new ContextCompressionPipeline({
        compressor: options.compressor,
        thresholdRatio: options.compressionThresholdRatio,
        tokenEstimator: this.tokenEstimator,
      });

    // Enforces the final runtime context budget.
    this.truncator =
      options.truncator ?? new ContextTruncator({tokenEstimator: this.tokenEstimator});

    // Assembles system prompt, output instructions and runtime context.
    this.assembler = options.assembler ?? new SystemPromptAssembler();
  }

  build(input: BuildContextInput): BuildContextResult {
    // Normalize, dedupe and sort sections before budget-sensitive processing.
    const registry = new ContextRegistry()
      .addMany(input.sections)
      .normalize()
      .dedupe()
      .sort(this.priorityPolicy);

    // Create a token budget that accounts for prompt, tools, history and output reserve.
    const budget = this.budgetPolicy.createBudget(input, this.tokenEstimator);
    const sections = registry.getAll();

    // Compress first so truncation works on smaller, higher-value sections.
    const compression = this.compressionPipeline.compress(sections, budget);

    // Truncate compressed sections to the runtime context budget.
    const truncation = this.truncator.truncate(compression.sections, budget);

    // Build the assembled system message content sent to the model.
    const assembledSystemPrompt = this.assembler.assemble({
      baseSystemPrompt: input.baseSystemPrompt,
      outputInstructions: input.outputInstructions,
      contextText: truncation.contextText,
    });

    // Re-count final text after compression/truncation/assembly for validation.
    const contextTextTokens = this.tokenEstimator.countText(truncation.contextText);
    const assembledSystemPromptTokens =
      this.tokenEstimator.countText(assembledSystemPrompt);

    // Final model input also includes conversation history and tool schemas.
    const finalInputTokens =
      assembledSystemPromptTokens + budget.conversationTokens + budget.toolSchemaTokens;

    // Input limit excludes the output tokens reserved for model generation.
    const inputTokenLimit = Math.max(
      0,
      budget.modelContextWindow - budget.reservedOutputTokens,
    );

    const remainingInputTokens = inputTokenLimit - finalInputTokens;

    // Attach final runtime numbers to the budget diagnostics.
    const finalBudget = {
      ...budget,
      finalInputTokens,
      remainingInputTokens,
    };

    // Token usage breakdown for debugging and observability.
    const tokenUsage = {
      modelContextWindow: budget.modelContextWindow,
      reservedOutputTokens: budget.reservedOutputTokens,
      systemPromptTokens: budget.systemPromptTokens,
      outputInstructionTokens: budget.outputInstructionTokens,
      toolSchemaTokens: budget.toolSchemaTokens,
      conversationTokens: budget.conversationTokens,
      safetyMarginTokens: budget.safetyMarginTokens,
      runtimeContextTokens: budget.runtimeContextTokens,
      contextTextTokens,
      finalInputTokens,
      remainingInputTokens,
    };

    // Fail fast if the final assembled request still exceeds the model window.
    if (remainingInputTokens < 0) {
      throw new ContextBudgetExceededError(
        `Final input exceeds the model context window by ${Math.abs(
          remainingInputTokens,
        )} tokens after reserving output tokens.`,
        tokenUsage,
      );
    }

    return {
      assembledSystemPrompt,
      contextText: truncation.contextText,
      tokenEstimate: assembledSystemPromptTokens,

      // Section-level inclusion results after truncation.
      includedSections: truncation.includedSections,
      partiallyIncludedSections: truncation.partiallyIncludedSections,
      omittedSections: truncation.omittedSections,
      sectionUsages: truncation.sectionUsages,

      diagnostics: {
        budget: finalBudget,
        tokenUsage,

        // Compression-level diagnostics.
        estimatedContextChars: compression.estimatedContextChars,
        estimatedContextTokens: compression.estimatedContextTokens,
        compressionThresholdRatio: compression.thresholdRatio,
        compressionTriggered: compression.triggered,
        compressionLimitTokens: compression.compressionLimitTokens,
        compressionResults: compression.results,

        // Final prompt-level diagnostics.
        contextTextTokens,
        systemPromptTokens: assembledSystemPromptTokens,
        finalInputTokens,
        remainingInputTokens,

        // Unified decision log for compression and truncation.
        sectionDecisions: [
          ...compression.results.map((result) => ({
            section: result.originalSection,
            stage: "compression" as const,
            action: result.compressed ? ("compressed" as const) : ("skipped" as const),
            reason: result.reason ?? "",
            originalTokens: result.originalTokens,
            outputTokens: result.compressedTokens,
            savedTokens: result.savedTokens,
          })),
          ...truncation.sectionUsages.map((usage) => ({
            section: usage.section,
            stage: "truncation" as const,
            action:
              usage.status === "included"
                ? ("included" as const)
                : usage.status === "partial"
                  ? ("partial" as const)
                  : ("omitted" as const),
            reason: usage.reason ?? "",
            originalTokens: usage.formattedTokens,
            outputTokens: usage.includedTokens,
          })),
        ],
      },
    };
  }
}
