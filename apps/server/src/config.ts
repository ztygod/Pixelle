import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
import {parse as parseToml} from "smol-toml";

export type PixelleServerConfig = {
  port: number;
  webOrigin: string;
};

export type LoadServerConfigOptions = {
  cwd?: string;
  configFile?: string;
  env?: Record<string, string | undefined>;
};

const DEFAULT_CONFIG_PATH = fileURLToPath(
  new URL("../../../pixelle.toml", import.meta.url),
);

export async function loadServerConfig(
  options: LoadServerConfigOptions = {},
): Promise<PixelleServerConfig> {
  const cwd = options.cwd ?? process.cwd();
  const configFile = options.configFile
    ? resolve(cwd, options.configFile)
    : DEFAULT_CONFIG_PATH;
  const env = options.env ?? process.env;
  const config = await loadTomlServerConfig(configFile);

  return {
    port: parsePort(env.PORT) ?? config.port,
    webOrigin: env.WEB_ORIGIN && env.WEB_ORIGIN !== ""
      ? env.WEB_ORIGIN
      : config.webOrigin,
  };
}

async function loadTomlServerConfig(
  filePath: string,
): Promise<PixelleServerConfig> {
  let content: string;
  try {
    content = await readFile(filePath, "utf8");
  } catch (error) {
    if (isNodeError(error) && error.code === "ENOENT") {
      throw new Error(
        `Pixelle config file not found at ${filePath}. Create pixelle.toml.`,
        {cause: error},
      );
    }

    throw error;
  }

  const parsed = parseToml(content);
  if (!isRecord(parsed.server)) {
    throw new Error(`Missing [server] config in ${filePath}.`);
  }

  return parseServerConfig(parsed.server, filePath);
}

function parseServerConfig(
  values: Record<string, unknown>,
  filePath: string,
): PixelleServerConfig {
  if (typeof values.port !== "number" || !Number.isInteger(values.port)) {
    throw new Error(`Invalid [server].port in ${filePath}. Expected an integer.`);
  }

  if (typeof values.webOrigin !== "string" || values.webOrigin.length === 0) {
    throw new Error(
      `Invalid [server].webOrigin in ${filePath}. Expected a non-empty string.`,
    );
  }

  return {
    port: values.port,
    webOrigin: values.webOrigin,
  };
}

function parsePort(value: string | undefined): number | undefined {
  if (value === undefined || value === "") {
    return undefined;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error(`Invalid PORT env value: ${value}. Expected a positive integer.`);
  }

  return port;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}
