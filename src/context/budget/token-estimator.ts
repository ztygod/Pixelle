import {countTokens} from "gpt-tokenizer";

export type TokenCountableMessage = {
  role: string;
  content?: unknown;
  name?: string;
  tool_call_id?: string;
  tool_calls?: unknown[];
};

const APPROX_CHARS_PER_TOKEN = 3;
const MESSAGE_OVERHEAD_TOKENS = 4;

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

    const cjkChars = text.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
    const nonCjkChars = text.length - cjkChars;

    return Math.max(1, Math.ceil(cjkChars + nonCjkChars / APPROX_CHARS_PER_TOKEN));
  }

  countMessages(messages: readonly TokenCountableMessage[]): number {
    return messages.reduce(
      (total, message) =>
        total + MESSAGE_OVERHEAD_TOKENS + this.countText(serializeMessage(message)),
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
        total + MESSAGE_OVERHEAD_TOKENS + this.countText(serializeMessage(message)),
      0,
    );
  }
}

export function createDefaultTokenEstimator(): TokenEstimator {
  return new GptTokenEstimator();
}

const defaultTokenEstimator = createDefaultTokenEstimator();

/** Compatibility helper for older call sites. */
export function estimateTokens(text: string): number {
  return defaultTokenEstimator.countText(text);
}

function serializeMessage(message: TokenCountableMessage): string {
  try {
    return JSON.stringify(message) ?? "";
  } catch {
    return `${message.role}\n${String(message.content ?? "")}`;
  }
}
