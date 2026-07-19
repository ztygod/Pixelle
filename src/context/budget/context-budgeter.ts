import {formatContextSection} from "../assembly/context-formatter.js";
import {ContextRegistry} from "./context-registry.js";
import type {BudgetedContext, ContextDocument, TranscriptProjection} from "../types.js";
import {DefaultContextBudgetPolicy, type ContextBudgetPolicy} from "./context-budget.js";
import {
  DefaultContextPriorityPolicy,
  type ContextPriorityPolicy,
} from "./priority-policy.js";
import {createDefaultTokenEstimator, type TokenEstimator} from "./token-estimator.js";

export type ContextBudgeterOptions = {
  priorityPolicy?: ContextPriorityPolicy;
  budgetPolicy?: ContextBudgetPolicy;
  compressionThresholdRatio?: number;
  tokenEstimator?: TokenEstimator;
};

/** Normalizes context and decides its budget before compression executes. */
export class ContextBudgeter {
  private readonly priorityPolicy: ContextPriorityPolicy;
  private readonly budgetPolicy: ContextBudgetPolicy;
  private readonly compressionThresholdRatio: number;
  private readonly tokenEstimator: TokenEstimator;

  constructor(options: ContextBudgeterOptions = {}) {
    this.priorityPolicy = options.priorityPolicy ?? new DefaultContextPriorityPolicy();
    this.budgetPolicy = options.budgetPolicy ?? new DefaultContextBudgetPolicy();
    this.compressionThresholdRatio = options.compressionThresholdRatio ?? 0.85;
    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();
  }

  budget(
    document: ContextDocument,
    projection: TranscriptProjection,
    tokenLimit: number,
  ): BudgetedContext {
    const sections = new ContextRegistry()
      .addMany([...document.sections, ...projection.archivedSections])
      .normalize()
      .dedupe()
      .sort(this.priorityPolicy)
      .getAll();
    const budget = this.budgetPolicy.createBudget({tokenLimit});
    const formattedContextText = sections
      .map((section) => formatContextSection(section))
      .filter((text) => text.length > 0)
      .join("\n\n");
    const estimatedContextChars = formattedContextText.length;
    const estimatedContextTokens = this.tokenEstimator.countText(formattedContextText);
    const compressionLimitTokens = Math.floor(
      budget.maxInputTokens * this.compressionThresholdRatio,
    );

    return {
      budget,
      sections,
      compressionRequired: estimatedContextTokens > compressionLimitTokens,
      diagnostics: {
        estimatedContextChars,
        estimatedContextTokens,
        compressionLimitTokens,
        compressionThresholdRatio: this.compressionThresholdRatio,
      },
    };
  }
}
