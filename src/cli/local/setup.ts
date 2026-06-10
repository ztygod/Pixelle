import path from "node:path";

import {
  cancel,
  confirm,
  intro,
  isCancel,
  log,
  outro,
  password,
  select,
  spinner,
  text,
} from "@clack/prompts";
import chalk from "chalk";

import {
  assertWorkspaceDirectory,
  providerForPreset,
  resolveLocalCliConfigPath,
  type LocalCliConfig,
  type LocalProviderPreset,
  LOCAL_CLI_CONFIG_VERSION,
} from "../../config/local-cli-config.js";

type ProviderChoice = {
  label: string;
  preset: LocalProviderPreset;
  defaultModel: string;
  defaultBaseUrl?: string;
  apiKeyRequired: boolean;
};

const PROVIDERS: readonly ProviderChoice[] = [
  {
    label: "OpenAI Compatible",
    preset: "openai-compatible",
    defaultModel: "gpt-4.1",
    apiKeyRequired: true,
  },
  {
    label: "Anthropic Compatible",
    preset: "anthropic-compatible",
    defaultModel: "claude-sonnet-4-5",
    apiKeyRequired: true,
  },
  {
    label: "Local OpenAI-compatible",
    preset: "local-openai-compatible",
    defaultModel: "qwen2.5-coder",
    defaultBaseUrl: "http://localhost:11434/v1",
    apiKeyRequired: false,
  },
];

export async function runLocalCliSetup(
  existing?: LocalCliConfig,
): Promise<LocalCliConfig> {
  intro(chalk.cyan("Pixelle Agent setup"));

  const provider = await askProvider(existing);
  const apiKey = await askApiKey(provider, existing);
  const baseUrl = await askBaseUrl(provider, existing);
  const model = await askModel(provider, existing);
  const workspaceDir = await askWorkspace(existing);

  const shouldSave = await confirm({
    message: "Save this configuration?",
    initialValue: true,
  });
  assertNotCancelled(shouldSave);
  if (!shouldSave) {
    throw new Error("Setup cancelled.");
  }

  const config: LocalCliConfig = {
    version: LOCAL_CLI_CONFIG_VERSION,
    providerPreset: provider.preset,
    provider: providerForPreset(provider.preset),
    model,
    apiKey,
    baseUrl,
    workspaceDir,
  };

  const saveSpinner = spinner();
  saveSpinner.start("Preparing local configuration");
  saveSpinner.stop(`Configuration ready: ${resolveLocalCliConfigPath()}`);

  outro(
    [
      chalk.green("Pixelle is ready."),
      chalk.gray(`Provider: ${provider.label}`),
      chalk.gray(`Model: ${model}`),
      chalk.gray(`Workspace: ${workspaceDir}`),
    ].join("\n"),
  );

  return config;
}

async function askProvider(
  existing: LocalCliConfig | undefined,
): Promise<ProviderChoice> {
  const current = existing?.providerPreset ?? PROVIDERS[0]?.preset;
  const selected = await select({
    message: "Choose an LLM provider",
    initialValue: current,
    options: PROVIDERS.map((provider) => ({
      value: provider.preset,
      label: provider.label,
      hint:
        provider.preset === "local-openai-compatible"
          ? "Ollama, LM Studio, vLLM, or any OpenAI-compatible local server"
          : undefined,
    })),
  });
  assertNotCancelled(selected);

  const provider = PROVIDERS.find((candidate) => candidate.preset === selected);
  if (!provider) {
    throw new Error("Invalid provider selection.");
  }

  return provider;
}

async function askApiKey(
  provider: ProviderChoice,
  existing: LocalCliConfig | undefined,
): Promise<string | undefined> {
  const hasExistingKey = Boolean(existing?.apiKey);
  const value = await password({
    message: hasExistingKey
      ? "API key (leave blank to keep existing)"
      : provider.apiKeyRequired
        ? "API key"
        : "API key (optional for local providers)",
    validate(inputValue) {
      if (!provider.apiKeyRequired || hasExistingKey || (inputValue ?? "").trim()) {
        return undefined;
      }

      return "API key is required for this provider.";
    },
  });
  assertNotCancelled(value);

  const normalized = value.trim();
  if (normalized) {
    return normalized;
  }

  return hasExistingKey ? existing?.apiKey : undefined;
}

async function askBaseUrl(
  provider: ProviderChoice,
  existing: LocalCliConfig | undefined,
): Promise<string | undefined> {
  const value = await text({
    message: "Base URL",
    placeholder: provider.defaultBaseUrl ?? "Optional",
    initialValue: existing?.baseUrl ?? provider.defaultBaseUrl,
    validate(inputValue) {
      const normalized = (inputValue ?? "").trim();
      if (!normalized) {
        return undefined;
      }

      try {
        new URL(normalized);
        return undefined;
      } catch {
        return "Enter a valid URL, or leave blank.";
      }
    },
  });
  assertNotCancelled(value);

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

async function askModel(
  provider: ProviderChoice,
  existing: LocalCliConfig | undefined,
): Promise<string> {
  const value = await text({
    message: "Model",
    initialValue: existing?.model ?? provider.defaultModel,
    validate(inputValue) {
      return (inputValue ?? "").trim() ? undefined : "Model is required.";
    },
  });
  assertNotCancelled(value);

  return value.trim();
}

async function askWorkspace(existing: LocalCliConfig | undefined): Promise<string> {
  while (true) {
    const value = await text({
      message: "Workspace",
      initialValue: existing?.workspaceDir ?? process.cwd(),
      validate(inputValue) {
        return (inputValue ?? "").trim() ? undefined : "Workspace is required.";
      },
    });
    assertNotCancelled(value);

    try {
      return await assertWorkspaceDirectory(path.resolve(value.trim()));
    } catch (error) {
      log.error(error instanceof Error ? error.message : "Invalid workspace directory.");
    }
  }
}

function assertNotCancelled<T>(value: T | symbol): asserts value is T {
  if (isCancel(value)) {
    cancel("Setup cancelled.");
    throw new Error("Setup cancelled.");
  }
}
