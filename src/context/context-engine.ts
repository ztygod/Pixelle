import {DefaultContextBudgetPolicy} from "./context-budget.js";
import {NoopContextCompressor} from "./context-compressor.js";
import {ContextRegistry} from "./context-registry.js";
import {ContextTruncator} from "./context-truncator.js";
import {DefaultContextPriorityPolicy} from "./priority-policy.js";
import {SystemPromptAssembler} from "./system-prompt-assembler.js";
import {estimateTokens} from "./token-estimator.js";
import type {ContextBudgetPolicy} from "./context-budget.js";
import type {ContextCompressor} from "./context-compressor.js";
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
  private readonly compressor: ContextCompressor;
  private readonly truncator: ContextTruncator;
  private readonly assembler: SystemPromptAssembler;

  constructor(options: ContextEngineOptions = {}) {
    this.priorityPolicy = options.priorityPolicy ?? new DefaultContextPriorityPolicy();
    this.budgetPolicy = options.budgetPolicy ?? new DefaultContextBudgetPolicy();
    this.compressor = options.compressor ?? new NoopContextCompressor();
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
    const compressedSections = registry
      .getAll()
      .map((section) => this.compressor.compress(section, budget).section);
    const truncation = this.truncator.truncate(compressedSections, budget);
    const systemPrompt = this.assembler.assemble({
      systemPrompt: input.systemPrompt,
      outputInstructions: input.outputInstructions,
      contextText: truncation.contextText,
    });

    return {
      systemPrompt,
      contextText: truncation.contextText,
      tokenEstimate: estimateTokens(truncation.contextText),
      includedSections: truncation.includedSections,
      partialSections: truncation.partialSections,
      droppedSections: truncation.droppedSections,
      sectionUsages: truncation.sectionUsages,
    };
  }
}
