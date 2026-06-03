import type {LLMConfig} from "../config/index.js";
import {BaseLLMClient} from "./llm-base.js";
import {AnthropicClient} from "./provider/anthropic-client.js";
import {OpenAIClient} from "./provider/openai-client.js";
import type {GenerateInput, GenerateResult, LLMClientConfig} from "./types.js";

type LLMConfigLike = LLMClientConfig | LLMConfig;

/**
 * LLMClient is the public LLM entry point for Agent Runtime.
 *
 * Runtime constructs one client from config.llm and calls generate() through
 * Pixelle's unified protocol. Provider selection, SDK initialization, and
 * message/tool conversion stay inside this module, so Runtime never imports
 * provider SDK types.
 */
export class LLMClient extends BaseLLMClient {
  private readonly providerClient: BaseLLMClient;

  constructor(config: LLMConfigLike) {
    super();
    const values = hasToJson(config) ? config.toJSON() : config;

    // Keep provider construction here so Runtime depends on one stable client
    // even as provider-specific SDK setup changes over time.
    switch (values.provider) {
      case "openai":
        this.providerClient = new OpenAIClient(values);
        break;
      case "anthropic":
        this.providerClient = new AnthropicClient(values);
        break;
      default:
        throw new Error(`Unsupported LLM provider: ${String(values.provider)}`);
    }
  }

  generate(input: GenerateInput): Promise<GenerateResult> {
    return this.providerClient.generate(input);
  }
}

function hasToJson(config: LLMConfigLike): config is LLMConfig {
  // Accept both raw config values and the config class exported by the config
  // module, without forcing Runtime callers to unwrap config.llm manually.
  return "toJSON" in config && typeof config.toJSON === "function";
}
