import type {ContextBudget} from "../types.js";

export type ContextBudgetInput = {
  tokenLimit: number;
  systemPromptTokens?: number;
  transcriptTokens?: number;
  toolSchemaTokens?: number;
  requestOverheadTokens?: number;
  sectionTokens?: number;
};

/** Strategy used to derive runtime context budget from build input. */
export interface ContextBudgetPolicy {
  createBudget(input: ContextBudgetInput): ContextBudget;
}

export type DefaultContextBudgetPolicyOptions = {
  defaultMaxContextTokens?: number;
  reservedOutputTokens?: number;
};

const DEFAULT_MAX_CONTEXT_TOKENS = 128_000;
const DEFAULT_RESERVED_OUTPUT_TOKENS = 4_000;

/** Default budget policy that derives an input token budget from the model limit. */
export class DefaultContextBudgetPolicy implements ContextBudgetPolicy {
  private readonly defaultMaxContextTokens: number;
  private readonly reservedOutputTokens: number;

  constructor(options: DefaultContextBudgetPolicyOptions = {}) {
    this.defaultMaxContextTokens = positiveIntegerOrDefault(
      options.defaultMaxContextTokens,
      DEFAULT_MAX_CONTEXT_TOKENS,
    );
    this.reservedOutputTokens = nonNegativeIntegerOrDefault(
      options.reservedOutputTokens,
      DEFAULT_RESERVED_OUTPUT_TOKENS,
    );
  }

  createBudget(input: ContextBudgetInput): ContextBudget {
    const maxContextTokens =
      input.tokenLimit > 0 ? Math.floor(input.tokenLimit) : this.defaultMaxContextTokens;
    const reservedOutputTokens = Math.min(
      this.reservedOutputTokens,
      Math.floor(maxContextTokens * 0.2),
    );
    const maxInputTokens = Math.max(0, maxContextTokens - reservedOutputTokens);
    // Very small synthetic/test windows cannot support a 256-token floor. Real
    // model windows receive the conservative 2%/256 minimum margin.
    const safetyMarginTokens =
      maxContextTokens >= 4_096
        ? Math.min(maxInputTokens, Math.max(256, Math.floor(maxInputTokens * 0.02)))
        : 0;
    const hardInputLimit = Math.max(0, maxInputTokens - safetyMarginTokens);
    const systemPromptTokens = input.systemPromptTokens ?? 0;
    const transcriptTokens = input.transcriptTokens ?? 0;
    const toolSchemaTokens = input.toolSchemaTokens ?? 0;
    const requestOverheadTokens = input.requestOverheadTokens ?? 0;
    const sectionTokens = input.sectionTokens ?? 0;
    const availableSectionTokens = Math.max(
      0,
      hardInputLimit -
        systemPromptTokens -
        transcriptTokens -
        toolSchemaTokens -
        requestOverheadTokens,
    );
    const estimatedTotalInputTokens =
      systemPromptTokens +
      transcriptTokens +
      toolSchemaTokens +
      requestOverheadTokens +
      sectionTokens;

    return {
      tokenLimit: input.tokenLimit,
      maxContextTokens,
      reservedOutputTokens,
      maxInputTokens,
      systemPromptTokens,
      transcriptTokens,
      toolSchemaTokens,
      requestOverheadTokens,
      safetyMarginTokens,
      hardInputLimit,
      availableSectionTokens,
      sectionTokens,
      estimatedTotalInputTokens,
      estimatedTotalRequestTokens:
        estimatedTotalInputTokens + reservedOutputTokens + safetyMarginTokens,
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
