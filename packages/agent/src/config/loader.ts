import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { config as loadDotEnv } from "dotenv";
import { AgentConfigSchema } from "./schema.js";
import type { AgentConfig, AgentConfigInput, LoadAgentConfigOptions } from "./types.js";

const DEFAULT_CONFIG_FILE = "pixelle.toml";

/** Loads pixelle.toml, applies environment overrides, and returns AgentConfig. */
export async function loadAgentConfig(
  options: LoadAgentConfigOptions = {},
): Promise<AgentConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configFile ?? DEFAULT_CONFIG_FILE);

  loadDotEnv({
    path: resolve(cwd, options.envFile ?? ".env"),
  });

  const toml = await readFile(configPath, "utf8");
  const fileConfig = parseToml(toml) as AgentConfigInput;

  const mergedConfig = {
    ...fileConfig,
    llm: {
      ...fileConfig.llm,
      apiKey: process.env.PIXELLE_LLM_API_KEY ?? fileConfig.llm?.apiKey,
      baseUrl: process.env.PIXELLE_LLM_BASE_URL ?? fileConfig.llm?.baseUrl,
      model: process.env.PIXELLE_LLM_MODEL ?? fileConfig.llm?.model,
    },
  };

  return AgentConfigSchema.parse(mergedConfig);
}
