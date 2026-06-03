export type LLMProvider = "openai" | "anthropic";

export type LLMClientConfig = {
  provider: LLMProvider;
  model: string;
  temperature: number;
  apiKey?: string;
  baseUrl?: string;
};

/**
 * PixelleMessage is the only message protocol the Agent Runtime should know.
 *
 * Runtime should not depend directly on OpenAI or Anthropic message formats
 * because each provider represents tool calls, tool results, and system prompts
 * differently. Keeping one Pixelle protocol lets Runtime implement the ReAct
 * loop once while provider adapters handle SDK-specific conversion internally.
 */
export type PixelleMessage =
  | {
      role: "system";
      content: string;
    }
  | {
      role: "user";
      content: string;
    }
  | {
      role: "assistant";
      content?: string;
      toolCalls?: readonly ToolCall[];
    }
  | {
      role: "tool";
      toolCallId: string;
      name: string;
      content: string;
    };

export type PixelleTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type GenerateInput = {
  messages: readonly PixelleMessage[];
  tools?: readonly PixelleTool[];
};

/**
 * GenerateResult is intentionally provider-neutral.
 *
 * OpenAI puts text and tool_calls on a chat message, while Anthropic represents
 * them as text/tool_use content blocks. Runtime only needs normalized assistant
 * text and the next tool calls to execute, so providers collapse raw SDK
 * responses into this stable shape.
 */
export type GenerateResult = {
  content: string;
  toolCalls: ToolCall[];
  usage?: LLMUsage;
  raw?: unknown;
};

export type LLMUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type LLMGenerateOptions = GenerateInput;
export type LLMGenerateResult = GenerateResult;
export type LLMMessage = PixelleMessage;
export type LLMMessageRole = PixelleMessage["role"];
