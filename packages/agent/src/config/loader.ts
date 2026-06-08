import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { parse as parseToml } from "smol-toml";
import { AgentConfigSchema } from "./schema.js";
import type { AgentConfig, AgentConfigInput, LoadAgentConfigOptions } from "./types.js";

const DEFAULT_CONFIG_FILE = "pixelle.toml";

/** Loads pixelle.toml and validates it as a complete AgentConfig. */
export async function loadAgentConfig(
  options: LoadAgentConfigOptions = {},
): Promise<AgentConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configFile ?? DEFAULT_CONFIG_FILE);

  const toml = await readFile(configPath, "utf8");
  const fileConfig = parseToml(toml) as AgentConfigInput;

  return AgentConfigSchema.parse(fileConfig);
}
