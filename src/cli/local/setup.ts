import {createInterface} from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import path from "node:path";

import {
  assertWorkspaceDirectory,
  providerForPreset,
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
  let rl = createPromptInterface();

  try {
    output.write("\nPixelle Agent local setup\n\n");
    const provider = await askProvider(rl, existing);
    rl.close();
    const apiKey = await askApiKey(provider, existing);
    rl = createPromptInterface();
    const baseUrl = normalizeOptional(
      await askText(
        rl,
        "Base URL",
        existing?.baseUrl ?? provider.defaultBaseUrl ?? "",
        false,
      ),
    );
    const model = await askText(
      rl,
      "Model",
      existing?.model ?? provider.defaultModel,
      true,
    );
    const workspaceDir = await askWorkspace(rl, existing);

    return {
      version: LOCAL_CLI_CONFIG_VERSION,
      providerPreset: provider.preset,
      provider: providerForPreset(provider.preset),
      model,
      apiKey,
      baseUrl,
      workspaceDir,
    };
  } finally {
    rl.close();
  }
}

function createPromptInterface(): ReturnType<typeof createInterface> {
  return createInterface({input, output});
}

async function askProvider(
  rl: ReturnType<typeof createInterface>,
  existing: LocalCliConfig | undefined,
): Promise<ProviderChoice> {
  const currentIndex = Math.max(
    0,
    PROVIDERS.findIndex((provider) => provider.preset === existing?.providerPreset),
  );

  output.write("Provider:\n");
  PROVIDERS.forEach((provider, index) => {
    output.write(`  ${index + 1}. ${provider.label}\n`);
  });

  while (true) {
    const answer = await rl.question(`Choose provider [${currentIndex + 1}]: `);
    const selected = answer.trim() ? Number(answer.trim()) - 1 : currentIndex;
    const provider = PROVIDERS[selected];

    if (provider) {
      return provider;
    }

    output.write("Please choose a valid provider number.\n");
  }
}

async function askApiKey(
  provider: ProviderChoice,
  existing: LocalCliConfig | undefined,
): Promise<string | undefined> {
  const hasExistingKey = Boolean(existing?.apiKey);
  const label = hasExistingKey
    ? "API Key [press Enter to keep existing]"
    : provider.apiKeyRequired
      ? "API Key"
      : "API Key [optional]";

  while (true) {
    const answer = await askSecret(`${label}: `);
    const value = normalizeOptional(answer);

    if (value) {
      return value;
    }

    if (hasExistingKey) {
      return existing?.apiKey;
    }

    if (!provider.apiKeyRequired) {
      return undefined;
    }

    output.write("API key is required for this provider.\n");
  }
}

async function askWorkspace(
  rl: ReturnType<typeof createInterface>,
  existing: LocalCliConfig | undefined,
): Promise<string> {
  const defaultWorkspace = existing?.workspaceDir ?? process.cwd();

  while (true) {
    const answer = await askText(rl, "Workspace", defaultWorkspace, true);

    try {
      return await assertWorkspaceDirectory(path.resolve(answer));
    } catch (error) {
      output.write(
        `${error instanceof Error ? error.message : "Invalid workspace directory."}\n`,
      );
    }
  }
}

async function askText(
  rl: ReturnType<typeof createInterface>,
  label: string,
  defaultValue: string,
  required: boolean,
): Promise<string> {
  while (true) {
    const prompt = defaultValue ? `${label} [${defaultValue}]: ` : `${label}: `;
    const answer = await rl.question(prompt);
    const value = answer.trim() || defaultValue;

    if (!required || value) {
      return value;
    }

    output.write(`${label} is required.\n`);
  }
}

function askSecret(prompt: string): Promise<string> {
  if (!input.isTTY || !output.isTTY) {
    const rl = createInterface({input, output});
    return rl.question(prompt).finally(() => rl.close());
  }

  return new Promise((resolve, reject) => {
    const chunks: string[] = [];
    const onData = (chunk: Buffer): void => {
      const value = chunk.toString("utf8");

      if (value === "\u0003") {
        cleanup();
        reject(new Error("Setup cancelled."));
        return;
      }

      if (value === "\r" || value === "\n" || value === "\r\n") {
        output.write("\n");
        cleanup();
        resolve(chunks.join(""));
        return;
      }

      if (value === "\u007f" || value === "\b") {
        chunks.pop();
        return;
      }

      chunks.push(value);
    };
    const cleanup = (): void => {
      input.off("data", onData);
      input.setRawMode(false);
      input.pause();
    };

    output.write(prompt);
    input.resume();
    input.setRawMode(true);
    input.on("data", onData);
  });
}

function normalizeOptional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
