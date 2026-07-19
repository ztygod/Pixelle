/** Complete Pixelle agent configuration exposed by the config loader. */
export type AgentConfig = {
  llm: LLMClientConfig;
  runtime: RuntimeConfig;
  permissions: PermissionConfig;
  verification: VerificationConfig;
  trace: TraceConfig;
};

/** Runtime-ready LLM configuration loaded from pixelle.toml. */
export type LLMClientConfig = {
  provider: LLMProvider;
  model: string;
  temperature: number;
  timeoutMs: number;
  maxRetries: number;
  apiKey?: string;
  apiKeyEnv?: string;
  baseUrl?: string;
};

/** Agent loop options consumed by runtime code. */
export type RuntimeConfig = {
  maxIterations: number;
  maxRepairAttempts: number;
  tokensLimit: number;
  systemInstructions: string[];
  workspaceDir: string;
  rollbackOnFailure: boolean;
};

export type PermissionConfig = {
  readFile: boolean;
  writeFile: boolean;
  network: boolean;
  shell: boolean;
};

export type VerificationConfig = {
  enabled: boolean;
  commands: string[];
};

export type TraceConfig = {
  enabled: boolean;
  directory: string;
};

/** Partial config shape accepted from pixelle.toml before validation. */
export type AgentConfigInput = {
  llm?: Partial<LLMClientConfig>;
  runtime?: Partial<RuntimeConfig>;
  permissions?: Partial<PermissionConfig>;
  verification?: Partial<VerificationConfig>;
  trace?: Partial<TraceConfig>;
};

/** Options for locating pixelle.toml*/
export type LoadAgentConfigOptions = {
  cwd?: string;
  configFile?: string;
};

/** LLM provider. */
export type LLMProvider = "openai-compatible" | "anthropic";

export type LoadPixelleConfigOptions = LoadAgentConfigOptions;
