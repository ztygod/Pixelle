import type {BaseLLMClient} from "../../llm/llm-base.js";
import type {LLMMessage} from "../../llm/types.js";
import {
  createDefaultTokenEstimator,
  estimateRequestTokens,
  type TokenEstimator,
} from "../budget/token-estimator.js";

export type TranscriptSummaryInput = {
  messages: readonly LLMMessage[];
  maxTokens: number;
  previousSummary?: string;
};

/** Optional async semantic summarizer. Implementations must not mutate the input transcript. */
export interface TranscriptSummarizer {
  summarize(input: TranscriptSummaryInput): Promise<string>;
}

/** Semantic summarizer backed by an LLM client and intentionally exposed without tools. */
export class ModelTranscriptSummarizer implements TranscriptSummarizer {
  constructor(private readonly client: BaseLLMClient) {}

  async summarize(input: TranscriptSummaryInput): Promise<string> {
    let rollingSummary = input.previousSummary ?? "";
    for (const historyChunk of chunkMessages(input.messages, 24_000)) {
      const response = await this.client.generate({
        messages: [
          {
            role: "system",
            content:
              "Summarize conversation history faithfully. Include: current goal, user constraints, key decisions, completed work, files, tool conclusions, failures, and unresolved items. Do not invent facts.",
          },
          {
            role: "user",
            content: `${rollingSummary ? `Previous summary:\n${rollingSummary.slice(0, 8_000)}\n\n` : ""}History:\n${historyChunk}`,
          },
        ],
        tools: [],
        maxRetries: 0,
      });
      rollingSummary = response.content.trim();
    }
    return rollingSummary;
  }
}

export type TranscriptBudgetResult = {
  messages: readonly LLMMessage[];
  tokensBefore: number;
  tokensAfter: number;
  summarizedMessageCount: number;
};

/** Compacts only complete, unprotected transcript prefixes. */
export class TranscriptBudgeter {
  private readonly estimator: TokenEstimator;

  constructor(
    private readonly options: {
      tokenEstimator?: TokenEstimator;
      summarizer?: TranscriptSummarizer;
    } = {},
  ) {
    this.estimator = options.tokenEstimator ?? createDefaultTokenEstimator();
  }

  async compact(
    messages: readonly LLMMessage[],
    maxTokens: number,
  ): Promise<TranscriptBudgetResult> {
    const tokensBefore = estimateRequestTokens(this.estimator, messages).messageTokens;
    if (tokensBefore <= maxTokens) {
      return {
        messages,
        tokensBefore,
        tokensAfter: tokensBefore,
        summarizedMessageCount: 0,
      };
    }

    const protectedStart = findProtectedStart(messages);
    const prefix = messages.slice(0, protectedStart);
    const protectedMessages = messages.slice(protectedStart);
    const protectedTokens = estimateRequestTokens(
      this.estimator,
      protectedMessages,
    ).messageTokens;
    if (!prefix.length || protectedTokens > maxTokens) {
      return {
        messages: protectedMessages,
        tokensBefore,
        tokensAfter: protectedTokens,
        summarizedMessageCount: prefix.length,
      };
    }

    const summaryBudget = Math.max(0, maxTokens - protectedTokens - 8);
    let summary = "";
    if (summaryBudget > 0 && this.options.summarizer) {
      try {
        summary = await this.options.summarizer.summarize({
          messages: prefix,
          maxTokens: summaryBudget,
        });
      } catch {
        summary = "";
      }
    }
    if (!summary) summary = deterministicSummary(prefix);
    summary = truncateToTokens(summary, summaryBudget, this.estimator);
    const compacted: LLMMessage[] = summary
      ? [
          {role: "user", content: `[Historical conversation summary]\n${summary}`},
          ...protectedMessages,
        ]
      : [...protectedMessages];
    const tokensAfter = estimateRequestTokens(this.estimator, compacted).messageTokens;
    return {
      messages: compacted,
      tokensBefore,
      tokensAfter,
      summarizedMessageCount: prefix.length,
    };
  }
}

function findProtectedStart(messages: readonly LLMMessage[]): number {
  let lastUser = -1;
  let latestToolExchange = -1;
  for (let i = 0; i < messages.length; i += 1) {
    const message = messages[i];
    if (message?.role === "user") lastUser = i;
    if (message?.role === "assistant" && message.toolCalls?.length)
      latestToolExchange = i;
  }
  const candidates = [lastUser, latestToolExchange].filter((index) => index >= 0);
  return candidates.length ? Math.min(...candidates) : Math.max(0, messages.length - 1);
}

function deterministicSummary(messages: readonly LLMMessage[]): string {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .map((message) =>
      `${message.role}: ${"content" in message ? (message.content ?? "") : ""}`.trim(),
    )
    .filter(Boolean)
    .join("\n");
}

function serializeMessage(message: LLMMessage): string {
  if (message.role === "assistant" && message.toolCalls?.length) {
    return `assistant: ${message.content ?? ""}\ntoolCalls: ${JSON.stringify(message.toolCalls)}`;
  }
  if (message.role === "tool") {
    return `tool ${message.name} (${message.toolCallId}): ${message.content}`;
  }
  return `${message.role}: ${"content" in message ? (message.content ?? "") : ""}`;
}

function chunkMessages(messages: readonly LLMMessage[], maxChars: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const message of messages) {
    const serialized = serializeMessage(message).slice(0, maxChars);
    const candidate = current ? `${current}\n\n${serialized}` : serialized;
    if (candidate.length > maxChars && current) {
      chunks.push(current);
      current = serialized;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function truncateToTokens(
  text: string,
  maxTokens: number,
  estimator: TokenEstimator,
): string {
  if (maxTokens <= 0) return "";
  if (estimator.countText(text) <= maxTokens) return text;
  let low = 0;
  let high = text.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (estimator.countText(text.slice(0, middle)) <= maxTokens) low = middle;
    else high = middle - 1;
  }
  return text.slice(0, low).trimEnd();
}
