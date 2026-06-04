import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
import {BaseLLMClient} from "../llm-base.js";
import {classifyLLMError, requestWithRetry} from "../../utils/llm-utils.js";
import type {
  LLMClientConfig,
  LLMGenerateInput,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMStreamInput,
  LLMTool,
  LLMToolCall,
  LLMUsage,
} from "../types.js";

type ConvertedAnthropicMessages = {
  system?: string;
  messages: MessageParam[];
};

type StreamingToolCall = {
  id?: string;
  name?: string;
  arguments: string;
};

/** Adapts Anthropic Messages APIs to Pixelle's LLM interface. */
export class AnthropicLLMClient extends BaseLLMClient {
  private readonly client: Anthropic;
  private readonly config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    super();
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  async generate(input: LLMGenerateInput): Promise<LLMResponse> {
    const convertedMessages = this.convertMessages(input.messages);
    const response = await requestWithRetry(
      (signal) =>
        this.client.messages.create(
          {
            model: this.config.model,
            max_tokens: 4096,
            temperature: this.config.temperature,
            system: convertedMessages.system,
            messages: convertedMessages.messages,
            tools: input.tools?.length
              ? this.convertTools(input.tools)
              : undefined,
          },
          {signal},
        ),
      {
        config: this.config,
        timeoutMs: input.timeoutMs,
        maxRetries: input.maxRetries,
      },
    );

    return this.parseResponse(response);
  }

  async *stream(input: LLMStreamInput): AsyncIterable<LLMStreamChunk> {
    const convertedMessages = this.convertMessages(input.messages);
    const contentParts: string[] = [];
    const toolCalls = new Map<number, StreamingToolCall>();

    const stream = await requestWithRetry(
      (signal) =>
        Promise.resolve(
          this.client.messages.stream(
            {
              model: this.config.model,
              max_tokens: 4096,
              temperature: this.config.temperature,
              system: convertedMessages.system,
              messages: convertedMessages.messages,
              tools: input.tools?.length
                ? this.convertTools(input.tools)
                : undefined,
            },
            {signal},
          ),
        ),
      {
        config: this.config,
        timeoutMs: input.timeoutMs,
        maxRetries: input.maxRetries,
      },
    );

    try {
      for await (const event of stream) {
        if (isToolUseStartEvent(event)) {
          const current = toolCalls.get(event.index) ?? {arguments: ""};
          current.id = event.content_block.id;
          current.name = event.content_block.name;
          toolCalls.set(event.index, current);

          yield {
            type: "tool_call_delta",
            toolCall: {
              index: event.index,
              id: current.id,
              name: current.name,
              arguments: parseJsonObject(current.arguments),
            },
            raw: event,
          };
          continue;
        }

        if (!isContentBlockDeltaEvent(event)) {
          continue;
        }

        if (event.delta.type === "text_delta") {
          contentParts.push(event.delta.text);
          yield {
            type: "content_delta",
            content: event.delta.text,
            raw: event,
          };
          continue;
        }

        if (event.delta.type === "input_json_delta") {
          const current = toolCalls.get(event.index) ?? {arguments: ""};
          current.arguments += event.delta.partial_json;
          toolCalls.set(event.index, current);

          yield {
            type: "tool_call_delta",
            toolCall: {
              index: event.index,
              id: current.id,
              name: current.name,
              arguments: parseJsonObject(current.arguments),
            },
            raw: event,
          };
        }
      }
    } catch (error) {
      throw classifyLLMError(error, this.config);
    }

    const response: LLMResponse = {
      content: contentParts.join(""),
      toolCalls: [...toolCalls.entries()].map(([, toolCall]) => ({
        id: toolCall.id ?? "",
        name: toolCall.name ?? "",
        arguments: parseJsonObject(toolCall.arguments),
      })),
    };

    yield {
      type: "done",
      response,
    };
  }

  private convertMessages(
    messages: readonly LLMMessage[],
  ): ConvertedAnthropicMessages {
    const systemMessages: string[] = [];
    const convertedMessages: MessageParam[] = [];

    for (const message of messages) {
      switch (message.role) {
        case "system":
          systemMessages.push(message.content);
          break;
        case "user":
          convertedMessages.push({
            role: "user",
            content: message.content,
          });
          break;
        case "assistant":
          convertedMessages.push({
            role: "assistant",
            content: [
              ...(message.content
                ? [{type: "text" as const, text: message.content}]
                : []),
              ...(message.toolCalls?.map((toolCall) => ({
                type: "tool_use" as const,
                id: toolCall.id,
                name: toolCall.name,
                input: toolCall.arguments,
              })) ?? []),
            ],
          });
          break;
        case "tool":
          convertedMessages.push({
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: message.toolCallId,
                content: message.content,
              } satisfies ToolResultBlockParam,
            ],
          });
          break;
      }
    }

    return {
      system: systemMessages.length ? systemMessages.join("\n\n") : undefined,
      messages: convertedMessages,
    };
  }

  private convertTools(tools: readonly LLMTool[]): Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: toAnthropicInputSchema(tool.inputSchema),
    }));
  }

  private parseResponse(response: Message): LLMResponse {
    const textParts: string[] = [];
    const toolCalls: LLMToolCall[] = [];

    for (const contentBlock of response.content) {
      if (contentBlock.type === "text") {
        textParts.push(contentBlock.text);
      }

      if (contentBlock.type === "tool_use") {
        toolCalls.push({
          id: contentBlock.id,
          name: contentBlock.name,
          arguments: parseInputObject(contentBlock.input),
        });
      }
    }

    return {
      content: textParts.join(""),
      toolCalls,
      usage: this.parseUsage(response.usage),
      raw: response,
    };
  }

  private parseUsage(usage: Message["usage"] | undefined): LLMUsage | undefined {
    if (!usage) {
      return undefined;
    }

    return {
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      totalTokens: usage.input_tokens + usage.output_tokens,
    };
  }
}

function isContentBlockDeltaEvent(
  event: unknown,
): event is {
  type: "content_block_delta";
  index: number;
  delta:
    | {type: "text_delta"; text: string}
    | {type: "input_json_delta"; partial_json: string};
} {
  if (!isRecord(event) || event.type !== "content_block_delta") {
    return false;
  }

  const delta = event.delta;
  return (
    typeof event.index === "number" &&
    isRecord(delta) &&
    ((delta.type === "text_delta" && typeof delta.text === "string") ||
      (delta.type === "input_json_delta" &&
        typeof delta.partial_json === "string"))
  );
}

function isToolUseStartEvent(
  event: unknown,
): event is {
  type: "content_block_start";
  index: number;
  content_block: {type: "tool_use"; id: string; name: string};
} {
  if (!isRecord(event) || event.type !== "content_block_start") {
    return false;
  }

  const contentBlock = event.content_block;
  return (
    typeof event.index === "number" &&
    isRecord(contentBlock) &&
    contentBlock.type === "tool_use" &&
    typeof contentBlock.id === "string" &&
    typeof contentBlock.name === "string"
  );
}

function parseInputObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsedValue: unknown = JSON.parse(value);
    return parseInputObject(parsedValue);
  } catch {
    return {};
  }
}

function toAnthropicInputSchema(
  inputSchema: Record<string, unknown>,
): Tool["input_schema"] {
  return {
    type: "object",
    ...inputSchema,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}
