import type {LLMConfig} from "../config/index.js";
import {BaseLLMClient} from "./llm-base.js";
import {AnthropicLLMClient} from "./provider/anthropic-compatible-client.js";
import {OpenAICompatibleLLMClient} from "./provider/openai-compatible-client.js";
import type {
  LLMClientConfig,
  LLMGenerateInput,
  LLMResponse,
  LLMStreamChunk,
  LLMStreamInput,
} from "./types.js";

type LLMConfigLike = LLMClientConfig | LLMConfig;

/** Public LLM facade that selects the configured provider adapter. */
export class LLMClient extends BaseLLMClient {
  private readonly providerClient: BaseLLMClient;

  constructor(config: LLMConfigLike) {
    super();

    switch (config.provider) {
      case "openai-compatible":
        this.providerClient = new OpenAICompatibleLLMClient(config);
        break;
      case "anthropic":
        this.providerClient = new AnthropicLLMClient(config);
        break;
    }
  }

  generate(input: LLMGenerateInput): Promise<LLMResponse> {
    return this.providerClient.generate(input);
  }

  stream(input: LLMStreamInput): AsyncIterable<LLMStreamChunk> {
    return this.providerClient.stream(input);
  }
}
