import type {LLMConfigValues} from "../types.js";

export class LLMConfig {
  readonly provider: LLMConfigValues["provider"];
  readonly model: string;
  readonly temperature: number;
  readonly timeoutMs: number;
  readonly apiKey?: string;
  readonly baseUrl?: string;

  constructor(values: LLMConfigValues) {
    // Config classes intentionally do not read files or environment variables.
    // The loader owns I/O, schemas own validation, and this class only exposes
    // normalized values for runtime consumers.
    this.provider = values.provider;
    this.model = values.model;
    this.temperature = values.temperature;
    this.timeoutMs = values.timeoutMs;
    this.apiKey = values.apiKey;
    this.baseUrl = values.baseUrl;
  }

  toJSON(): LLMConfigValues {
    return {
      provider: this.provider,
      model: this.model,
      temperature: this.temperature,
      timeoutMs: this.timeoutMs,
      apiKey: this.apiKey,
      baseUrl: this.baseUrl,
    };
  }
}
