import type {BuildContextInput, ContextBudget} from "./types.js";

/** Strategy used to derive runtime context budget from build input. */
export interface ContextBudgetPolicy {
  createBudget(input: BuildContextInput): ContextBudget;
}

export type DefaultContextBudgetPolicyOptions = {
  defaultMaxContextTokens?: number;
  reservedOutputTokens?: number;
  /** @deprecated kept only to populate legacy char diagnostics. */
  runtimeContextRatio?: number;
};

const DEFAULT_MAX_CONTEXT_TOKENS = 128_000;
const DEFAULT_RESERVED_OUTPUT_TOKENS = 4_000;

/** Default budget policy that derives an input token budget from the model limit. */
export class DefaultContextBudgetPolicy implements ContextBudgetPolicy {
  private readonly defaultMaxContextTokens: number;
  private readonly reservedOutputTokens: number;
  private readonly runtimeContextRatio: number;

  constructor(options: DefaultContextBudgetPolicyOptions = {}) {
    this.defaultMaxContextTokens = positiveIntegerOrDefault(
      options.defaultMaxContextTokens,
      DEFAULT_MAX_CONTEXT_TOKENS,
    );
    this.reservedOutputTokens = nonNegativeIntegerOrDefault(
      options.reservedOutputTokens,
      DEFAULT_RESERVED_OUTPUT_TOKENS,
    );
    this.runtimeContextRatio = options.runtimeContextRatio ?? 0.35;
  }

  createBudget(input: BuildContextInput): ContextBudget {
    const maxContextTokens =
      input.tokenLimit > 0 ? Math.floor(input.tokenLimit) : this.defaultMaxContextTokens;
    const reservedOutputTokens = Math.min(
      this.reservedOutputTokens,
      Math.floor(maxContextTokens * 0.2),
    );
    const maxInputTokens = Math.max(0, maxContextTokens - reservedOutputTokens);

    return {
      tokenLimit: input.tokenLimit,
      maxContextTokens,
      reservedOutputTokens,
      maxInputTokens,
      runtimeContextRatio: this.runtimeContextRatio,
      maxContextChars: Math.max(0, maxInputTokens * 4),
    };
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
