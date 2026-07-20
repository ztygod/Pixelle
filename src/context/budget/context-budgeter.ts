import {formatContextSection} from "../assembly/context-formatter.js";
import {ContextRegistry} from "./context-registry.js";
import type {BudgetedContext, ContextDocument, TranscriptProjection} from "../types.js";
import {DefaultContextBudgetPolicy, type ContextBudgetPolicy} from "./context-budget.js";
import {
  DefaultContextPriorityPolicy,
  type ContextPriorityPolicy,
} from "./priority-policy.js";
import {createDefaultTokenEstimator, type TokenEstimator} from "./token-estimator.js";
import {estimateRequestTokens} from "./token-estimator.js";
import type {LLMTool} from "../../llm/types.js";

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
    systemPrompt = "",
    tools: readonly LLMTool[] = [],
  ): BudgetedContext {
    const sections = new ContextRegistry()
      .addMany([...document.sections, ...projection.archivedSections])
      .normalize()
      .dedupe()
      .sort(this.priorityPolicy)
      .getAll();
    const formattedContextText = sections
      .map((section) => formatContextSection(section))
      .filter((text) => text.length > 0)
      .join("\n\n");
    const estimatedContextChars = formattedContextText.length;
    const estimatedContextTokens = this.tokenEstimator.countText(formattedContextText);
    const baseMessages = [
      ...(systemPrompt ? [{role: "system" as const, content: systemPrompt}] : []),
      ...projection.messages,
    ];
    const requestEstimate =
      baseMessages.length || tools.length
        ? estimateRequestTokens(this.tokenEstimator, baseMessages, tools)
        : {messageTokens: 0, toolSchemaTokens: 0, overheadTokens: 0, totalTokens: 0};
    const systemPromptTokens = systemPrompt
      ? this.tokenEstimator.countText(systemPrompt)
      : 0;
    const budget = this.budgetPolicy.createBudget({
      tokenLimit,
      systemPromptTokens,
      transcriptTokens: Math.max(0, requestEstimate.messageTokens - systemPromptTokens),
      toolSchemaTokens: requestEstimate.toolSchemaTokens,
      requestOverheadTokens: requestEstimate.overheadTokens,
      sectionTokens: estimatedContextTokens,
    });
    const compressionLimitTokens = Math.floor(
      budget.availableSectionTokens * this.compressionThresholdRatio,
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
