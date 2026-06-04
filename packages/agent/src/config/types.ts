/** Supported LLM providers in agent configuration. */
export type LLMProvider = "openai-compatible" | "anthropic";

/** Runtime-ready LLM configuration after TOML and env overrides are merged. */
export type LLMConfig = {
  provider: LLMProvider;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  apiKey?: string;
  baseUrl?: string;
};

/** Agent loop options consumed by runtime code. */
export type RuntimeConfig = {
  maxIterations: number;
  enablePlanning: boolean;
  enableReflection: boolean;
};

/** Complete Pixelle agent configuration exposed by the config loader. */
export type AgentConfig = {
  llm: LLMConfig;
  runtime: RuntimeConfig;
};

/** Partial config shape accepted from pixelle.toml before validation. */
export type AgentConfigInput = {
  llm?: Partial<LLMConfig>;
  runtime?: Partial<RuntimeConfig>;
};

/** Options for locating pixelle.toml and optional env overrides. */
export type LoadAgentConfigOptions = {
  cwd?: string;
  configFile?: string;
  envFile?: string;
  env?: Record<string, string | undefined>;
};

export type LoadPixelleConfigOptions = LoadAgentConfigOptions;
