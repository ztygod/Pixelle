import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import {BaseLLMClient} from "../llm-base.js";
import {LLMResponseFormatError} from "../errors.js";
import {classifyLLMError, requestWithRetry} from "../request.js";
import type {
  LLMGenerateInput,
  LLMMessage,
  LLMResponse,
  LLMStreamChunk,
  LLMStreamInput,
  LLMTool,
  LLMToolCall,
  LLMUsage,
} from "../types.js";
import type {LLMClientConfig} from "../../config/index.js";

type StreamingToolCall = {
  id?: string;
  name?: string;
  arguments: string;
};

/** Adapts OpenAI-compatible chat completion APIs to Pixelle's LLM interface. */
export class OpenAICompatibleLLMClient extends BaseLLMClient {
  private readonly client: OpenAI;
  private readonly config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    super();
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl,
    });
  }

  override async generate(input: LLMGenerateInput): Promise<LLMResponse> {
    const response = await requestWithRetry(
      (signal) =>
        this.client.chat.completions.create(
          {
            model: this.config.model,
            temperature: this.config.temperature,
            messages: this.convertMessages(input.messages),
            tools: input.tools?.length ? this.convertTools(input.tools) : undefined,
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

  override async *stream(input: LLMStreamInput): AsyncIterable<LLMStreamChunk> {
    const toolCalls = new Map<number, StreamingToolCall>();
    const contentParts: string[] = [];

    let stream: Awaited<ReturnType<OpenAI["chat"]["completions"]["create"]>>;

    try {
      stream = await requestWithRetry(
        (signal) =>
          this.client.chat.completions.create(
            {
              model: this.config.model,
              temperature: this.config.temperature,
              messages: this.convertMessages(input.messages),
              tools: input.tools?.length ? this.convertTools(input.tools) : undefined,
              stream: true,
            },
            {signal},
          ),
        {
          config: this.config,
          timeoutMs: input.timeoutMs,
          maxRetries: input.maxRetries,
        },
      );
    } catch (error) {
      throw classifyLLMError(error, this.config);
    }

    try {
      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        const content = delta?.content;

        if (typeof content === "string" && content.length > 0) {
          contentParts.push(content);
          yield {
            type: "content_delta",
            content,
            raw: chunk,
          };
        }

        for (const toolCallDelta of delta?.tool_calls ?? []) {
          // Tool call arguments stream as JSON fragments keyed by tool-call index.
          const index = toolCallDelta.index;
          const current = toolCalls.get(index) ?? {arguments: ""};
          current.id = toolCallDelta.id ?? current.id;
          current.name = toolCallDelta.function?.name ?? current.name;
          current.arguments += toolCallDelta.function?.arguments ?? "";
          toolCalls.set(index, current);

          yield {
            type: "tool_call_delta",
            toolCall: {
              index,
              id: current.id,
              name: current.name,
              arguments: parseJsonObject(current.arguments),
            },
            raw: chunk,
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

  private convertMessages(messages: readonly LLMMessage[]): ChatCompletionMessageParam[] {
    return messages.map((message) => {
      switch (message.role) {
        case "system":
          return {
            role: "system",
            content: message.content,
          };
        case "user":
          return {
            role: "user",
            content: message.content,
          };
        case "assistant":
          return {
            role: "assistant",
            content: message.content ?? null,
            tool_calls: message.toolCalls?.map((toolCall) => ({
              id: toolCall.id,
              type: "function",
              function: {
                name: toolCall.name,
                arguments: JSON.stringify(toolCall.arguments),
              },
            })),
          };
        case "tool":
          return {
            role: "tool",
            tool_call_id: message.toolCallId,
            content: message.content,
          };
      }
    });
  }

  private convertTools(tools: readonly LLMTool[]): ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  private parseResponse(response: OpenAI.Chat.Completions.ChatCompletion): LLMResponse {
    const message = response.choices[0]?.message;
    if (!message) {
      throw new LLMResponseFormatError(
        "OpenAI-compatible provider returned no completion message.",
        {
          provider: this.config.provider,
          model: this.config.model,
          cause: response,
        },
      );
    }

    return {
      content: typeof message.content === "string" ? message.content : "",
      toolCalls: this.parseToolCalls(message.tool_calls ?? []),
      usage: this.parseUsage(response.usage),
      raw: response,
    };
  }

  private parseToolCalls(
    toolCalls: readonly OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
  ): LLMToolCall[] {
    return toolCalls
      .filter((toolCall) => toolCall.type === "function")
      .map((toolCall) => ({
        id: toolCall.id,
        name: toolCall.function.name,
        arguments: parseJsonObject(toolCall.function.arguments),
      }));
  }

  private parseUsage(
    usage: OpenAI.Completions.CompletionUsage | undefined,
  ): LLMUsage | undefined {
    if (!usage) {
      return undefined;
    }

    return {
      inputTokens: usage.prompt_tokens,
      outputTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    };
  }
}

function parseJsonObject(value: string): Record<string, unknown> {
  try {
    const parsedValue: unknown = JSON.parse(value);
    if (parsedValue && typeof parsedValue === "object" && !Array.isArray(parsedValue)) {
      return parsedValue as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}
