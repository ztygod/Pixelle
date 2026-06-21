import {ContextCompressionPipeline} from "./context-compression-pipeline.js";
import {DefaultContextBudgetPolicy} from "./context-budget.js";
import {ContextRegistry} from "./context-registry.js";
import {ContextTruncator} from "./context-truncator.js";
import {DefaultContextPriorityPolicy} from "./priority-policy.js";
import {SystemPromptAssembler} from "./system-prompt-assembler.js";
import {createDefaultTokenEstimator, type TokenEstimator} from "./token-estimator.js";
import type {ContextBudgetPolicy} from "./context-budget.js";
import type {ContextPriorityPolicy} from "./priority-policy.js";
import type {
  BuildContextInput,
  BuildContextResult,
  ContextEngineOptions,
} from "./types.js";

/** Class-based context engine that owns the full runtime context pipeline. */
export class ContextEngine {
  private readonly priorityPolicy: ContextPriorityPolicy;
  private readonly budgetPolicy: ContextBudgetPolicy;
  private readonly compressionPipeline: ContextCompressionPipeline;
  private readonly truncator: ContextTruncator;
  private readonly assembler: SystemPromptAssembler;
  private readonly tokenEstimator: TokenEstimator;

  constructor(options: ContextEngineOptions = {}) {
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();
    this.priorityPolicy = options.priorityPolicy ?? new DefaultContextPriorityPolicy();
    this.budgetPolicy = options.budgetPolicy ?? new DefaultContextBudgetPolicy();
    this.compressionPipeline =
      options.compressionPipeline ??
      new ContextCompressionPipeline({
        compressor: options.compressor,
        thresholdRatio: options.compressionThresholdRatio,
        tokenEstimator: this.tokenEstimator,
      });
    this.truncator =
      options.truncator ?? new ContextTruncator({tokenEstimator: this.tokenEstimator});
    this.assembler = options.assembler ?? new SystemPromptAssembler();
  }

  build(input: BuildContextInput): BuildContextResult {
    const registry = new ContextRegistry()
      .addMany(input.sections)
      .normalize()
      .dedupe()
      .sort(this.priorityPolicy);
    const budget = this.budgetPolicy.createBudget(input);
    const sections = registry.getAll();
    const compression = this.compressionPipeline.compress(sections, budget);
    const truncation = this.truncator.truncate(compression.sections, budget);
    const systemPrompt = this.assembler.assemble({
      systemPrompt: input.systemPrompt,
      outputInstructions: input.outputInstructions,
      contextText: truncation.contextText,
    });
    const contextTextTokens = this.tokenEstimator.countText(truncation.contextText);
    const systemPromptTokens = this.tokenEstimator.countText(systemPrompt);

    return {
      systemPrompt,
      contextText: truncation.contextText,
      tokenEstimate: systemPromptTokens,
      includedSections: truncation.includedSections,
      partialSections: truncation.partialSections,
      droppedSections: truncation.droppedSections,
      sectionUsages: truncation.sectionUsages,
      diagnostics: {
        budget,
        estimatedContextChars: compression.estimatedContextChars,
        estimatedContextTokens: compression.estimatedContextTokens,
        compressionThresholdRatio: compression.thresholdRatio,
        compressionTriggered: compression.triggered,
        compressionLimitTokens: compression.compressionLimitTokens,
        compressionResults: compression.results,
        contextTextTokens,
        systemPromptTokens,
      },
    };
  }
}
