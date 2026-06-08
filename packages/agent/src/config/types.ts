/** Complete Pixelle agent configuration exposed by the config loader. */
export type AgentConfig = {
  llm: LLMClientConfig;
  runtime: RuntimeConfig;
};

/** Runtime-ready LLM configuration loaded from pixelle.toml. */
export type LLMClientConfig = {
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
  tokensLimit: number;
  systemPrompt: string;
  workspaceDir: string;
};

/** Partial config shape accepted from pixelle.toml before validation. */
export type AgentConfigInput = {
  llm?: Partial<LLMClientConfig>;
  runtime?: Partial<RuntimeConfig>;
};

/** Options for locating pixelle.toml*/
export type LoadAgentConfigOptions = {
  cwd?: string;
  configFile?: string;
};

/** LLM provider. */
export type LLMProvider = "openai-compatible" | "anthropic";

export type LoadPixelleConfigOptions = LoadAgentConfigOptions;
