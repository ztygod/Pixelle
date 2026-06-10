import {mkdir, readFile, stat, writeFile, chmod} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {z} from "zod";

import type {AgentConfig, LLMProvider} from "./types.js";

export const LOCAL_CLI_CONFIG_VERSION = 1;

export const LocalProviderPresetSchema = z.enum([
  "openai-compatible",
  "anthropic-compatible",
  "local-openai-compatible",
]);

export type LocalProviderPreset = z.infer<typeof LocalProviderPresetSchema>;

export const LocalCliConfigSchema = z.object({
  version: z.literal(LOCAL_CLI_CONFIG_VERSION),
  providerPreset: LocalProviderPresetSchema,
  provider: z.enum(["openai-compatible", "anthropic"]),
  model: z.string().min(1),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  workspaceDir: z.string().min(1),
});

export type LocalCliConfig = z.infer<typeof LocalCliConfigSchema>;

export type LocalCliConfigPathOptions = {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homeDir?: string;
};

const APP_DIR_NAME = "Pixelle";
const DEFAULT_SYSTEM_PROMPT =
  "You are Pixelle, an autonomous coding agent. Solve the user's request by reasoning carefully, using tools when needed, and explaining the final outcome clearly.";

export function resolveLocalCliConfigDir(
  options: LocalCliConfigPathOptions = {},
): string {
  const env = options.env ?? process.env;
  const platform = options.platform ?? process.platform;
  const homeDir = options.homeDir ?? os.homedir();

  if (env.PIXELLE_CONFIG_HOME) {
    return path.resolve(env.PIXELLE_CONFIG_HOME);
  }

  if (platform === "win32") {
    return path.join(
      env.APPDATA ?? path.join(homeDir, "AppData", "Roaming"),
      APP_DIR_NAME,
    );
  }

  if (platform === "darwin") {
    return path.join(homeDir, "Library", "Application Support", APP_DIR_NAME);
  }

  return path.join(env.XDG_CONFIG_HOME ?? path.join(homeDir, ".config"), "pixelle");
}

export function resolveLocalCliConfigPath(
  options: LocalCliConfigPathOptions = {},
): string {
  return path.join(resolveLocalCliConfigDir(options), "config.json");
}

export async function loadLocalCliConfig(
  configPath = resolveLocalCliConfigPath(),
): Promise<LocalCliConfig | undefined> {
  try {
    const raw = await readFile(configPath, "utf8");
    return LocalCliConfigSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

export async function saveLocalCliConfig(
  config: LocalCliConfig,
  configPath = resolveLocalCliConfigPath(),
): Promise<void> {
  const parsedConfig = LocalCliConfigSchema.parse(config);

  await mkdir(path.dirname(configPath), {recursive: true, mode: 0o700});
  await writeFile(configPath, `${JSON.stringify(parsedConfig, null, 2)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });

  try {
    await chmod(configPath, 0o600);
  } catch {
    // Best effort on platforms/filesystems that ignore POSIX modes.
  }
}

export async function assertWorkspaceDirectory(workspaceDir: string): Promise<string> {
  const resolvedWorkspace = path.resolve(workspaceDir);
  const info = await stat(resolvedWorkspace);

  if (!info.isDirectory()) {
    throw new Error(`Workspace is not a directory: ${resolvedWorkspace}`);
  }

  return resolvedWorkspace;
}

export function providerForPreset(preset: LocalProviderPreset): LLMProvider {
  return preset === "anthropic-compatible" ? "anthropic" : "openai-compatible";
}

export function localCliConfigToAgentConfig(config: LocalCliConfig): AgentConfig {
  const workspaceDir = path.resolve(config.workspaceDir);
  const isLocalProvider = config.providerPreset === "local-openai-compatible";

  return {
    llm: {
      provider: config.provider,
      model: config.model,
      temperature: 0.2,
      timeoutMs: 120_000,
      maxRetries: 2,
      apiKey: config.apiKey ?? (isLocalProvider ? "pixelle-local" : undefined),
      baseUrl: config.baseUrl,
    },
    runtime: {
      workspaceDir,
      maxIterations: 10,
      maxRepairAttempts: 0,
      tokensLimit: 32_000,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      rollbackOnFailure: true,
    },
    permissions: {
      readFile: true,
      writeFile: false,
      shell: false,
      network: false,
    },
    verification: {
      enabled: false,
      commands: [],
    },
    trace: {
      enabled: true,
      directory: path.join(workspaceDir, ".pixelle"),
    },
  };
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
