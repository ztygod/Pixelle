import {readFile} from "node:fs/promises";
import {dirname, resolve} from "node:path";
import {parse as parseToml} from "smol-toml";
import {AgentConfigInputSchema, AgentConfigSchema} from "./schema.js";
import type {AgentConfig, AgentConfigInput, LoadAgentConfigOptions} from "./types.js";

const DEFAULT_CONFIG_FILE = "pixelle.toml";
const DEFAULT_SYSTEM_PROMPT =
  "You are Pixelle, an autonomous coding agent. Solve the user's request by reasoning carefully, using tools when needed, and explaining the final outcome clearly.";

/** Loads pixelle.toml and validates it as a complete AgentConfig. */
export async function loadAgentConfig(
  options: LoadAgentConfigOptions = {},
): Promise<AgentConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configPath = resolve(cwd, options.configFile ?? DEFAULT_CONFIG_FILE);

  const toml = await readFile(configPath, "utf8");
  const fileConfig = AgentConfigInputSchema.parse(parseToml(toml) as AgentConfigInput);

  return AgentConfigSchema.parse(normalizeAgentConfig(fileConfig, configPath));
}

function normalizeAgentConfig(input: AgentConfigInput, configPath: string): AgentConfig {
  const configDir = dirname(configPath);
  const apiKey =
    input.llm?.apiKey ??
    (input.llm?.apiKeyEnv ? process.env[input.llm.apiKeyEnv] : undefined);

  return {
    llm: {
      provider: input.llm?.provider ?? "openai-compatible",
      model: input.llm?.model ?? "gpt-4.1",
      temperature: input.llm?.temperature ?? 0.2,
      timeoutMs: input.llm?.timeoutMs ?? 120_000,
      maxRetries: input.llm?.maxRetries ?? 2,
      apiKey,
      apiKeyEnv: input.llm?.apiKeyEnv,
      baseUrl: input.llm?.baseUrl,
    },
    runtime: {
      maxIterations: input.runtime?.maxIterations ?? 10,
      maxRepairAttempts: input.runtime?.maxRepairAttempts ?? 2,
      tokensLimit: input.runtime?.tokensLimit ?? 32_000,
      systemPrompt: input.runtime?.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      workspaceDir: resolve(configDir, input.runtime?.workspaceDir ?? "."),
      rollbackOnFailure: input.runtime?.rollbackOnFailure ?? true,
    },
    permissions: {
      readFile: input.permissions?.readFile ?? true,
      writeFile: input.permissions?.writeFile ?? false,
      network: input.permissions?.network ?? false,
      shell: input.permissions?.shell ?? false,
    },
    verification: {
      enabled: input.verification?.enabled ?? true,
      commands: [...(input.verification?.commands ?? [])],
    },
    trace: {
      enabled: input.trace?.enabled ?? true,
      directory: resolve(configDir, input.trace?.directory ?? ".pixelle"),
    },
  };
}
