import {createDefaultTokenEstimator, type TokenEstimator} from "./token-estimator.js";
import type {BuildContextInput, ContextBudget} from "../types.js";

/**
 * Budget policy interface.
 *
 * Its job is to calculate how many tokens can be used by runtime context
 * after reserving space for system prompt, tools, conversation history and output.
 */
export interface ContextBudgetPolicy {
  createBudget(input: BuildContextInput, tokenEstimator?: TokenEstimator): ContextBudget;
}

export type DefaultContextBudgetPolicyOptions = {
  /** Fallback model context window when input.tokenLimit is not provided. */
  defaultMaxContextTokens?: number;

  /** Tokens reserved for model output generation. */
  reservedOutputTokens?: number;

  /** Extra buffer to avoid hitting the model limit exactly. */
  safetyMarginTokens?: number;
};

const DEFAULT_MAX_CONTEXT_TOKENS = 128_000;
const DEFAULT_RESERVED_OUTPUT_TOKENS = 4_000;
const DEFAULT_SAFETY_MARGIN_TOKENS = 0;

/**
 * Default budget policy.
 *
 * It derives the runtime context budget from:
 *
 * model context window
 * - reserved output tokens
 * - base system prompt tokens
 * - output instruction tokens
 * - tool schema tokens
 * - conversation history tokens
 * - safety margin tokens
 */
export class DefaultContextBudgetPolicy implements ContextBudgetPolicy {
  private readonly defaultMaxContextTokens: number;
  private readonly reservedOutputTokens: number;
  private readonly safetyMarginTokens: number;

  constructor(options: DefaultContextBudgetPolicyOptions = {}) {
    // Normalize and validate default model context window.
    this.defaultMaxContextTokens = positiveIntegerOrDefault(
      options.defaultMaxContextTokens,
      DEFAULT_MAX_CONTEXT_TOKENS,
    );

    // Normalize and validate output token reserve.
    this.reservedOutputTokens = nonNegativeIntegerOrDefault(
      options.reservedOutputTokens,
      DEFAULT_RESERVED_OUTPUT_TOKENS,
    );

    // Normalize and validate safety margin.
    this.safetyMarginTokens = nonNegativeIntegerOrDefault(
      options.safetyMarginTokens,
      DEFAULT_SAFETY_MARGIN_TOKENS,
    );
  }

  createBudget(
    input: BuildContextInput,
    tokenEstimator: TokenEstimator = createDefaultTokenEstimator(),
  ): ContextBudget {
    // Use input.tokenLimit if provided; otherwise fall back to the default model window.
    const modelContextWindow =
      input.tokenLimit > 0 ? Math.floor(input.tokenLimit) : this.defaultMaxContextTokens;

    // Reserve output tokens, but cap it to 20% of the model window for small models.
    const reservedOutputTokens = Math.min(
      this.reservedOutputTokens,
      Math.floor(modelContextWindow * 0.2),
    );

    // This is the total input-side budget after reserving model output space.
    const inputTokenBudget = Math.max(0, modelContextWindow - reservedOutputTokens);

    // Count fixed prompt components before allocating budget to runtime context.
    const systemPromptTokens = tokenEstimator.countText(input.baseSystemPrompt ?? "");

    const outputInstructionTokens = tokenEstimator.countText(
      input.outputInstructions ?? "",
    );

    // Tool schemas also consume input tokens. Prefer caller-provided estimate if present.
    const toolSchemaTokens =
      input.toolSchemaTokens ??
      estimateSerializableTokens(input.toolSchemas ?? [], tokenEstimator);

    // Conversation history also consumes input tokens. Prefer caller-provided estimate if present.
    const conversationTokens =
      input.conversationTokens ??
      estimateConversationTokens(input.conversationMessages ?? [], tokenEstimator);

    // Safety margin can be overridden per build input.
    const safetyMarginTokens = nonNegativeIntegerOrDefault(
      input.safetyMarginTokens,
      this.safetyMarginTokens,
    );

    // Runtime context gets only the remaining input budget.
    const runtimeContextTokens = Math.max(
      0,
      inputTokenBudget -
        systemPromptTokens -
        outputInstructionTokens -
        toolSchemaTokens -
        conversationTokens -
        safetyMarginTokens,
    );

    // finalInputTokens and remainingInputTokens are filled later by ContextEngine
    // after compression, truncation and prompt assembly are complete.
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

/**
 * Estimate token usage of conversation messages.
 *
 * If the estimator supports countMessages, use it.
 * Otherwise, fall back to counting each role + content pair as plain text.
 */
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

/**
 * Estimate tokens for serializable objects, mainly tool schemas.
 */
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

/**
 * Return a positive integer, or fallback if the value is invalid.
 */
function positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.floor(value);
}

/**
 * Return a non-negative integer, or fallback if the value is invalid.
 */
function nonNegativeIntegerOrDefault(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value) || value < 0) {
    return fallback;
  }

  return Math.floor(value);
}
