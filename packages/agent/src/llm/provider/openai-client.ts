import OpenAI from "openai";
import type {
  ChatCompletionMessageParam,
  ChatCompletionTool,
} from "openai/resources/chat/completions";
import {BaseLLMClient} from "../llm-base.js";
import type {
  GenerateInput,
  GenerateResult,
  LLMClientConfig,
  LLMUsage,
  PixelleMessage,
  PixelleTool,
  ToolCall,
} from "../types.js";

export class OpenAIClient extends BaseLLMClient {
  private readonly client: OpenAI;
  private readonly config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    super();
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      // baseURL lets OpenAI-compatible providers share this adapter.
      baseURL: config.baseUrl,
    });
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const response = await this.client.chat.completions.create({
      model: this.config.model,
      temperature: this.config.temperature,
      messages: this.convertMessages(input.messages),
      tools: input.tools?.length ? this.convertTools(input.tools) : undefined,
    });

    return this.parseResponse(response);
  }

  private convertMessages(
    messages: readonly PixelleMessage[],
  ): ChatCompletionMessageParam[] {
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
            // Pixelle stores parsed tool arguments; OpenAI expects the function
            // arguments field to be a JSON string.
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
            // The OpenAI API links tool results back to the model-requested
            // function call through tool_call_id.
            tool_call_id: message.toolCallId,
            content: message.content,
          };
      }
    });
  }

  private convertTools(tools: readonly PixelleTool[]): ChatCompletionTool[] {
    return tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));
  }

  private parseResponse(
    response: OpenAI.Chat.Completions.ChatCompletion,
  ): GenerateResult {
    const message = response.choices[0]?.message;

    // Normalize the SDK response into the provider-neutral shape Runtime uses
    // for both plain assistant text and tool-call ReAct turns.
    return {
      content: typeof message?.content === "string" ? message.content : "",
      toolCalls: this.parseToolCalls(message?.tool_calls ?? []),
      usage: this.parseUsage(response.usage),
      raw: response,
    };
  }

  private parseToolCalls(
    toolCalls: readonly OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
  ): ToolCall[] {
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
    if (
      parsedValue &&
      typeof parsedValue === "object" &&
      !Array.isArray(parsedValue)
    ) {
      return parsedValue as Record<string, unknown>;
    }
  } catch {
    // Malformed provider output should not crash response normalization. The
    // Runtime can decide how to handle an empty argument object.
    return {};
  }

  return {};
}
