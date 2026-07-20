import {countTokens} from "gpt-tokenizer";
import type {LLMMessage, LLMTool} from "../../llm/types.js";

export type TokenCountableMessage = {
  role: string;
  content?: string | null;
};

/** Counts model tokens for runtime context budgeting. */
export interface TokenEstimator {
  countText(text: string): number;
  countMessages?(messages: readonly TokenCountableMessage[]): number;
  countRequest?(
    messages: readonly LLMMessage[],
    tools?: readonly LLMTool[],
  ): RequestTokenEstimate;
}

export type RequestTokenEstimate = {
  messageTokens: number;
  toolSchemaTokens: number;
  overheadTokens: number;
  totalTokens: number;
};

const TOKENS_PER_MESSAGE = 4;
const REQUEST_OVERHEAD = 3;

export function estimateRequestTokens(
  estimator: TokenEstimator,
  messages: readonly LLMMessage[],
  tools: readonly LLMTool[] = [],
): RequestTokenEstimate {
  if (estimator.countRequest) return estimator.countRequest(messages, tools);
  return countRequest(estimator, messages, tools);
}

function countRequest(
  estimator: Pick<TokenEstimator, "countText">,
  messages: readonly LLMMessage[],
  tools: readonly LLMTool[],
): RequestTokenEstimate {
  let messageTokens = 0;
  for (const message of messages) {
    messageTokens += estimator.countText(message.role);
    if ("content" in message && message.content)
      messageTokens += estimator.countText(message.content);
    if (message.role === "assistant") {
      for (const call of message.toolCalls ?? []) {
        messageTokens += estimator.countText(call.id) + estimator.countText(call.name);
        messageTokens += estimator.countText(JSON.stringify(call.arguments));
      }
    } else if (message.role === "tool") {
      messageTokens +=
        estimator.countText(message.toolCallId) + estimator.countText(message.name);
    }
  }
  const toolSchemaTokens = tools.reduce(
    (total, tool) => total + estimator.countText(JSON.stringify(tool)),
    0,
  );
  const overheadTokens =
    REQUEST_OVERHEAD + messages.length * TOKENS_PER_MESSAGE + tools.length * 2;
  return {
    messageTokens,
    toolSchemaTokens,
    overheadTokens,
    totalTokens: messageTokens + toolSchemaTokens + overheadTokens,
  };
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

  countRequest(
    messages: readonly LLMMessage[],
    tools: readonly LLMTool[] = [],
  ): RequestTokenEstimate {
    return countRequest(this, messages, tools);
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

  countRequest(
    messages: readonly LLMMessage[],
    tools: readonly LLMTool[] = [],
  ): RequestTokenEstimate {
    return countRequest(this, messages, tools);
  }
}

export function createDefaultTokenEstimator(): TokenEstimator {
  try {
    return new GptTokenEstimator();
  } catch {
    return new ApproxTokenEstimator();
  }
}
