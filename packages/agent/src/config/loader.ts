import {readFile} from "node:fs/promises";
import {isAbsolute, resolve} from "node:path";
import {DEFAULT_PIXELLE_CONFIG} from "./defaults.js";
import {PixelleAgentConfig} from "./pixelle-config.js";
import {PixelleConfigInputSchema, PixelleConfigSchema} from "./schemas.js";
import type {LoadPixelleConfigOptions, PixelleConfigInput} from "./types.js";

type EnvRecord = Record<string, string | undefined>;

const DEFAULT_CONFIG_FILE = "pixelle.config.json";
const DEFAULT_ENV_FILE = ".env";

export async function loadPixelleConfig(
  options: LoadPixelleConfigOptions = {},
): Promise<PixelleAgentConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configFile = resolveConfigPath(
    cwd,
    options.configFile ?? DEFAULT_CONFIG_FILE,
  );
  const envFile = resolveConfigPath(cwd, options.envFile ?? DEFAULT_ENV_FILE);

  // The loader is the only part of the config module that performs I/O. It
  // gathers sources, applies precedence, then hands validated values to the
  // config classes.
  const fileConfig = await loadJsonConfig(configFile);
  const envConfig = buildEnvConfig({
    ...(await loadEnvFile(envFile)),
    ...(options.env ?? process.env),
  });

  const mergedConfig = mergePixelleConfig(
    DEFAULT_PIXELLE_CONFIG,
    fileConfig,
    envConfig,
  );

  // zod turns unknown runtime input from JSON/env into a known TypeScript
  // shape before PixelleAgentConfig is constructed.
  return new PixelleAgentConfig(PixelleConfigSchema.parse(mergedConfig));
}

function resolveConfigPath(cwd: string, filePath: string): string {
  return isAbsolute(filePath) ? filePath : resolve(cwd, filePath);
}

async function loadJsonConfig(filePath: string): Promise<PixelleConfigInput> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }

  try {
    return PixelleConfigInputSchema.parse(JSON.parse(content));
  } catch (error) {
    throw new Error(`Failed to load Pixelle config from ${filePath}.`, {
      cause: error,
    });
  }
}

async function loadEnvFile(filePath: string): Promise<EnvRecord> {
  try {
    return parseEnvFile(await readFile(filePath, "utf8"));
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

function parseEnvFile(content: string): EnvRecord {
  const values: EnvRecord = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const rawValue = line.slice(separatorIndex + 1).trim();
    if (!key) {
      continue;
    }

    values[key] = unquoteEnvValue(rawValue);
  }

  return values;
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  const commentIndex = value.indexOf(" #");
  return commentIndex >= 0 ? value.slice(0, commentIndex).trimEnd() : value;
}

function buildEnvConfig(env: EnvRecord): PixelleConfigInput {
  const llm: PixelleConfigInput["llm"] = {};

  assignIfPresent(llm, "apiKey", env.OPENAI_API_KEY);
  assignIfPresent(llm, "baseUrl", env.OPENAI_BASE_URL);
  assignIfPresent(llm, "provider", env.OPENAI_PROVIDER);
  assignIfPresent(llm, "model", env.OPENAI_MODEL);

  if (env.OPENAI_TEMPERATURE !== undefined && env.OPENAI_TEMPERATURE !== "") {
    llm.temperature = Number(env.OPENAI_TEMPERATURE);
  }

  return Object.keys(llm).length > 0 ? {llm} : {};
}

function assignIfPresent<T extends Record<string, unknown>>(
  target: T,
  key: keyof T,
  value: string | undefined,
): void {
  if (value !== undefined && value !== "") {
    target[key] = value as T[keyof T];
  }
}

function mergePixelleConfig(
  ...configs: PixelleConfigInput[]
): PixelleConfigInput {
  return configs.reduce<PixelleConfigInput>(
    (mergedConfig, config) => ({
      llm: {...mergedConfig.llm, ...config.llm},
      agent: {...mergedConfig.agent, ...config.agent},
      tools: {...mergedConfig.tools, ...config.tools},
    }),
    {},
  );
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
