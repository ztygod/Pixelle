import type {
  AgentConfigValues,
  LLMConfigValues,
  PixelleConfigInput,
  PixelleConfigValues,
  ToolsConfigValues,
} from "./schemas.js";

export type {
  AgentConfigValues,
  LLMConfigValues,
  PixelleConfigInput,
  PixelleConfigValues,
  ToolsConfigValues,
};

export type LoadPixelleConfigOptions = {
  cwd?: string;
  configFile?: string;
  envFile?: string;
  env?: Record<string, string | undefined>;
};
