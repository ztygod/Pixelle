import type {BuildContextInput, ContextBudget} from "./types.js";

/** Strategy used to derive runtime context budget from build input. */
export interface ContextBudgetPolicy {
  createBudget(input: BuildContextInput): ContextBudget;
}

/** Default budget policy that preserves the existing 35% runtime context budget. */
export class DefaultContextBudgetPolicy implements ContextBudgetPolicy {
  private readonly runtimeContextRatio: number;

  constructor(options: {runtimeContextRatio?: number} = {}) {
    this.runtimeContextRatio = options.runtimeContextRatio ?? 0.35;
  }

  createBudget(input: BuildContextInput): ContextBudget {
    return {
      tokenLimit: input.tokenLimit,
      runtimeContextRatio: this.runtimeContextRatio,
      maxContextChars: Math.max(
        0,
        Math.floor(input.tokenLimit * 4 * this.runtimeContextRatio),
      ),
    };
  }
}
