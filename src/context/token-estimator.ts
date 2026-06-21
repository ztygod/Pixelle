import {countTokens} from "gpt-tokenizer";

export type TokenCountableMessage = {
  role: string;
  content?: string | null;
};

/** Counts model tokens for runtime context budgeting. */
export interface TokenEstimator {
  countText(text: string): number;
  countMessages?(messages: readonly TokenCountableMessage[]): number;
}

/** Fallback estimator used when an exact tokenizer is unavailable. */
export class ApproxTokenEstimator implements TokenEstimator {
  countText(text: string): number {
    if (!text) {
      return 0;
    }

    return Math.max(1, Math.ceil(text.length / 4));
  }

  countMessages(messages: readonly TokenCountableMessage[]): number {
    return messages.reduce(
      (total, message) =>
        total + this.countText(`${message.role}\n${message.content ?? ""}`),
      0,
    );
  }
}

/** Token estimator backed by gpt-tokenizer with a safe approximation fallback. */
export class GptTokenEstimator implements TokenEstimator {
  private readonly fallback = new ApproxTokenEstimator();

  countText(text: string): number {
    if (!text) {
      return 0;
    }

    try {
      return countTokens(text);
    } catch {
      return this.fallback.countText(text);
    }
  }

  countMessages(messages: readonly TokenCountableMessage[]): number {
    return messages.reduce(
      (total, message) =>
        total + this.countText(`${message.role}\n${message.content ?? ""}`),
      0,
    );
  }
}

export function createDefaultTokenEstimator(): TokenEstimator {
  try {
    return new GptTokenEstimator();
  } catch {
    return new ApproxTokenEstimator();
  }
}

const defaultTokenEstimator = createDefaultTokenEstimator();

/** Compatibility helper for older call sites. */
export function estimateTokens(text: string): number {
  return defaultTokenEstimator.countText(text);
}
