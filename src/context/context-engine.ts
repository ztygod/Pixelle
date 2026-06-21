import {ContextCompressionPipeline} from "./context-compression-pipeline.js";
import {DefaultContextBudgetPolicy} from "./context-budget.js";
import {ContextRegistry} from "./context-registry.js";
import {ContextTruncator} from "./context-truncator.js";
import {DefaultContextPriorityPolicy} from "./priority-policy.js";
import {SystemPromptAssembler} from "./system-prompt-assembler.js";
import {estimateTokens} from "./token-estimator.js";
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

  constructor(options: ContextEngineOptions = {}) {
    this.priorityPolicy = options.priorityPolicy ?? new DefaultContextPriorityPolicy();
    this.budgetPolicy = options.budgetPolicy ?? new DefaultContextBudgetPolicy();
    this.compressionPipeline =
      options.compressionPipeline ??
      new ContextCompressionPipeline({
        compressor: options.compressor,
        thresholdRatio: options.compressionThresholdRatio,
      });
    this.truncator = options.truncator ?? new ContextTruncator();
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
    const contextTextTokens = estimateTokens(truncation.contextText);
    const systemPromptTokens = estimateTokens(systemPrompt);

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
        compressionThresholdRatio: compression.thresholdRatio,
        compressionTriggered: compression.triggered,
        compressionResults: compression.results,
        contextTextTokens,
        systemPromptTokens,
      },
    };
  }
}
