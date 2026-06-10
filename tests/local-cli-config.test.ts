import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {afterEach, describe, expect, it} from "vitest";

import {
  loadLocalCliConfig,
  localCliConfigToAgentConfig,
  resolveLocalCliConfigPath,
  saveLocalCliConfig,
  type LocalCliConfig,
} from "../src/config/local-cli-config.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempDirs.splice(0).map((dir) => rm(dir, {recursive: true, force: true})),
  );
});

describe("local CLI config", () => {
  it("resolves config path from PIXELLE_CONFIG_HOME", () => {
    const configPath = resolveLocalCliConfigPath({
      env: {PIXELLE_CONFIG_HOME: "D:\\tmp\\pixelle-config"},
      platform: "win32",
      homeDir: "D:\\Users\\pixelle",
    });

    expect(configPath).toBe(path.join("D:\\tmp\\pixelle-config", "config.json"));
  });

  it("saves and loads local config", async () => {
    const dir = await createTempDir();
    const configPath = path.join(dir, "config.json");
    const config = createConfig({workspaceDir: dir});

    await saveLocalCliConfig(config, configPath);

    await expect(loadLocalCliConfig(configPath)).resolves.toEqual(config);
  });

  it("maps local config to conservative agent config", async () => {
    const dir = await createTempDir();
    const agentConfig = localCliConfigToAgentConfig(
      createConfig({
        workspaceDir: dir,
        providerPreset: "local-openai-compatible",
        provider: "openai-compatible",
        apiKey: undefined,
        baseUrl: "http://localhost:11434/v1",
      }),
    );

    expect(agentConfig.runtime.workspaceDir).toBe(dir);
    expect(agentConfig.llm.apiKey).toBe("pixelle-local");
    expect(agentConfig.permissions).toMatchObject({
      readFile: true,
      writeFile: false,
      shell: false,
      network: false,
    });
    expect(agentConfig.verification.enabled).toBe(false);
  });
});

async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "pixelle-test-"));
  tempDirs.push(dir);
  return dir;
}

function createConfig(overrides: Partial<LocalCliConfig>): LocalCliConfig {
  return {
    version: 1,
    providerPreset: "openai-compatible",
    provider: "openai-compatible",
    model: "gpt-4.1",
    apiKey: "test-key",
    workspaceDir: process.cwd(),
    ...overrides,
  };
}
