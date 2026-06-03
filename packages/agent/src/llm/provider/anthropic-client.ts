import Anthropic from "@anthropic-ai/sdk";
import type {
  Message,
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages/messages";
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

type ConvertedAnthropicMessages = {
  system?: string;
  messages: MessageParam[];
};

export class AnthropicClient extends BaseLLMClient {
  private readonly client: Anthropic;
  private readonly config: LLMClientConfig;

  constructor(config: LLMClientConfig) {
    super();
    this.config = config;
    this.client = new Anthropic({
      apiKey: config.apiKey,
      // baseURL is optional, but keeping it here supports Anthropic-compatible
      // gateways without adding a separate provider abstraction.
      baseURL: config.baseUrl,
    });
  }

  async generate(input: GenerateInput): Promise<GenerateResult> {
    const convertedMessages = this.convertMessages(input.messages);
    const response = await this.client.messages.create({
      model: this.config.model,
      max_tokens: 4096,
      temperature: this.config.temperature,
      system: convertedMessages.system,
      messages: convertedMessages.messages,
      tools: input.tools?.length ? this.convertTools(input.tools) : undefined,
    });

    return this.parseResponse(response);
  }

  private convertMessages(
    messages: readonly PixelleMessage[],
  ): ConvertedAnthropicMessages {
    // Anthropic keeps system prompts outside the messages array, unlike OpenAI.
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
              // Anthropic represents assistant tool calls as tool_use content
              // blocks, while Pixelle stores them as normalized ToolCall values.
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
                // Anthropic tool results are user-side content blocks tied back
                // to the original tool_use id.
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

  private convertTools(tools: readonly PixelleTool[]): Tool[] {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: toAnthropicInputSchema(tool.inputSchema),
    }));
  }

  private parseResponse(response: Message): GenerateResult {
    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];

    // Collapse Anthropic's mixed content blocks into the same GenerateResult
    // shape used by every provider adapter.
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

function parseInputObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return {};
}

function toAnthropicInputSchema(
  inputSchema: Record<string, unknown>,
): Tool["input_schema"] {
  // Anthropic requires an object JSON schema. Pixelle tools already carry JSON
  // schema-like input, so default the root type while preserving caller fields.
  return {
    type: "object",
    ...inputSchema,
  };
}
