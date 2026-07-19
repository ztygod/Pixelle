import type {LLMMessage} from "../../llm/types.js";
import type {ContextSection, TranscriptProjection} from "../types.js";

type AssistantToolMessage = Extract<LLMMessage, {role: "assistant"}> & {
  toolCalls: NonNullable<Extract<LLMMessage, {role: "assistant"}>["toolCalls"]>;
};

type ToolMessage = Extract<LLMMessage, {role: "tool"}>;

type ToolExchange = {
  toolMessages: ToolMessage[];
  endIndex: number;
};

/** Projects a mutable runtime transcript into the model-visible representation. */
export class TranscriptProjector {
  project(transcript: readonly LLMMessage[]): TranscriptProjection {
    const latestExchangeStart = findLatestCompletedToolExchangeStart(transcript);
    const messages: LLMMessage[] = [];
    const archivedSections: ContextSection[] = [];

    for (let index = 0; index < transcript.length; index += 1) {
      const message = transcript[index];
      if (!message || message.role === "system") {
        continue;
      }

      if (isAssistantWithToolCalls(message)) {
        const exchange = readToolExchange(transcript, index);
        if (exchange) {
          if (index === latestExchangeStart) {
            messages.push(message, ...exchange.toolMessages);
          } else {
            archivedSections.push(
              ...exchange.toolMessages.map((toolMessage) =>
                createToolResultSection(message, toolMessage),
              ),
            );
          }
          index = exchange.endIndex;
          continue;
        }
      }

      if (message.role !== "tool") {
        messages.push(message);
      }
    }

    return {messages, archivedSections};
  }
}

function isAssistantWithToolCalls(message: LLMMessage): message is AssistantToolMessage {
  return (
    message.role === "assistant" &&
    Array.isArray(message.toolCalls) &&
    message.toolCalls.length > 0
  );
}

function readToolExchange(
  messages: readonly LLMMessage[],
  assistantIndex: number,
): ToolExchange | undefined {
  const assistant = messages[assistantIndex];
  if (!assistant || !isAssistantWithToolCalls(assistant)) {
    return undefined;
  }

  const expectedIds = new Set(assistant.toolCalls.map((toolCall) => toolCall.id));
  const toolMessages: ToolMessage[] = [];
  let index = assistantIndex + 1;

  while (index < messages.length) {
    const message = messages[index];
    if (!message || message.role !== "tool" || !expectedIds.has(message.toolCallId)) {
      break;
    }

    toolMessages.push(message);
    index += 1;

    if (toolMessages.length === expectedIds.size) {
      return {toolMessages, endIndex: index - 1};
    }
  }

  return undefined;
}

function findLatestCompletedToolExchangeStart(
  messages: readonly LLMMessage[],
): number | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (readToolExchange(messages, index)) {
      return index;
    }
  }

  return undefined;
}

function createToolResultSection(
  assistant: AssistantToolMessage,
  toolMessage: ToolMessage,
): ContextSection {
  return {
    id: `tool-result:${toolMessage.toolCallId}`,
    replaceKey: `tool-result:${toolMessage.toolCallId}`,
    title: `Tool Result: ${toolMessage.name}`,
    priority: 40,
    source: {kind: "tool", ref: toolMessage.toolCallId},
    content: [
      `Tool: ${toolMessage.name}`,
      `Call ID: ${toolMessage.toolCallId}`,
      assistant.content ? `Assistant: ${assistant.content}` : undefined,
      "Result:",
      toolMessage.content,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
  };
}
