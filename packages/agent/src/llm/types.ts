/** Provider identifiers accepted by LLMClient. */
export type LLMProvider = "openai-compatible" | "anthropic";

/** Shared configuration used to construct provider-specific LLM clients. */
export type LLMClientConfig = {
  provider: LLMProvider;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  apiKey?: string;
  baseUrl?: string;
};

/** Provider-neutral chat message format used by Pixelle runtime code. */
export type LLMMessage =
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
      toolCalls?: readonly LLMToolCall[];
    }
  | {
      role: "tool";
      toolCallId: string;
      name: string;
      content: string;
    };

/** Provider-neutral tool declaration sent with an LLM request. */
export type LLMTool = {
  name: string;
  description?: string;
  inputSchema: Record<string, unknown>;
};

/** Normalized tool call requested by an assistant response. */
export type LLMToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

/** Input accepted by non-streaming LLM generation. */
export type LLMGenerateInput = {
  messages: readonly LLMMessage[];
  tools?: readonly LLMTool[];
  timeoutMs?: number;
  maxRetries?: number;
};

export type LLMStreamInput = LLMGenerateInput;

/** Normalized non-streaming LLM response. */
export type LLMResponse = {
  content: string;
  toolCalls: LLMToolCall[];
  usage?: LLMUsage;
  raw?: unknown;
};

/** Incremental chunk emitted by streaming LLM generation. */
export type LLMStreamChunk =
  | {
      type: "content_delta";
      content: string;
      raw?: unknown;
    }
  | {
      type: "tool_call_delta";
      toolCall: Partial<LLMToolCall> & {index: number};
      raw?: unknown;
    }
  | {
      type: "done";
      response: LLMResponse;
      raw?: unknown;
    };

/** Token usage normalized across providers when available. */
export type LLMUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
};

export type GenerateInput = LLMGenerateInput;
export type GenerateResult = LLMResponse;
export type LLMGenerateOptions = LLMGenerateInput;
export type LLMGenerateResult = LLMResponse;
export type PixelleMessage = LLMMessage;
export type PixelleTool = LLMTool;
export type ToolCall = LLMToolCall;
export type LLMMessageRole = LLMMessage["role"];
