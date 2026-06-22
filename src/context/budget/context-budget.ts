import {createDefaultTokenEstimator, type TokenEstimator} from "./token-estimator.js";
import type {BuildContextInput, ContextBudget} from "../types.js";

/** Strategy used to derive runtime context budget from build input. */
export interface ContextBudgetPolicy {
  createBudget(input: BuildContextInput, tokenEstimator?: TokenEstimator): ContextBudget;
}

export type DefaultContextBudgetPolicyOptions = {
  defaultMaxContextTokens?: number;
  reservedOutputTokens?: number;
  safetyMarginTokens?: number;
};

const DEFAULT_MAX_CONTEXT_TOKENS = 128_000;
const DEFAULT_RESERVED_OUTPUT_TOKENS = 4_000;
const DEFAULT_SAFETY_MARGIN_TOKENS = 0;

/** Default budget policy that derives an input token budget from the model limit. */
export class DefaultContextBudgetPolicy implements ContextBudgetPolicy {
  private readonly defaultMaxContextTokens: number;
  private readonly reservedOutputTokens: number;
  private readonly safetyMarginTokens: number;

  constructor(options: DefaultContextBudgetPolicyOptions = {}) {
    this.defaultMaxContextTokens = positiveIntegerOrDefault(
      options.defaultMaxContextTokens,
      DEFAULT_MAX_CONTEXT_TOKENS,
    );
    this.reservedOutputTokens = nonNegativeIntegerOrDefault(
      options.reservedOutputTokens,
      DEFAULT_RESERVED_OUTPUT_TOKENS,
    );
    this.safetyMarginTokens = nonNegativeIntegerOrDefault(
      options.safetyMarginTokens,
      DEFAULT_SAFETY_MARGIN_TOKENS,
    );
  }

  createBudget(
    input: BuildContextInput,
    tokenEstimator: TokenEstimator = createDefaultTokenEstimator(),
  ): ContextBudget {
    const modelContextWindow =
      input.tokenLimit > 0 ? Math.floor(input.tokenLimit) : this.defaultMaxContextTokens;
    const reservedOutputTokens = Math.min(
      this.reservedOutputTokens,
      Math.floor(modelContextWindow * 0.2),
    );
    const inputTokenBudget = Math.max(0, modelContextWindow - reservedOutputTokens);
    // Count non-runtime prompt components before allocating runtime context.
    const systemPromptTokens = tokenEstimator.countText(input.baseSystemPrompt ?? "");
    const outputInstructionTokens = tokenEstimator.countText(
      input.outputInstructions ?? "",
    );
    const toolSchemaTokens =
      input.toolSchemaTokens ??
      estimateSerializableTokens(input.toolSchemas ?? [], tokenEstimator);
    const conversationTokens =
      input.conversationTokens ??
      estimateConversationTokens(input.conversationMessages ?? [], tokenEstimator);
    const safetyMarginTokens = nonNegativeIntegerOrDefault(
      input.safetyMarginTokens,
      this.safetyMarginTokens,
    );
    // Runtime context receives only the input tokens left after fixed prompt costs.
    const runtimeContextTokens = Math.max(
      0,
      inputTokenBudget -
        systemPromptTokens -
        outputInstructionTokens -
        toolSchemaTokens -
        conversationTokens -
        safetyMarginTokens,
    );

    return {
      tokenLimit: input.tokenLimit,
      modelContextWindow,
      reservedOutputTokens,
      systemPromptTokens,
      outputInstructionTokens,
      toolSchemaTokens,
      conversationTokens,
      safetyMarginTokens,
      runtimeContextTokens,
      finalInputTokens: undefined,
      remainingInputTokens: undefined,
    };
  }
}

function estimateConversationTokens(
  messages: NonNullable<BuildContextInput["conversationMessages"]>,
  tokenEstimator: TokenEstimator,
): number {
  if (!messages.length) {
    return 0;
  }

  return (
    tokenEstimator.countMessages?.(messages) ??
    messages.reduce(
      (total, message) =>
        total + tokenEstimator.countText(`${message.role}\n${message.content ?? ""}`),
      0,
    )
  );
}

function estimateSerializableTokens(
  value: unknown,
  tokenEstimator: TokenEstimator,
): number {
  if (Array.isArray(value) && value.length === 0) {
    return 0;
  }

  try {
    return tokenEstimator.countText(JSON.stringify(value));
  } catch {
    return tokenEstimator.countText(String(value));
  }
}

function positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

function nonNegativeIntegerOrDefault(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}
