import {mkdtemp, writeFile} from "node:fs/promises";
import {dirname, join, resolve} from "node:path";
import {tmpdir} from "node:os";
import {fileURLToPath} from "node:url";

import {describe, expect, it} from "vitest";

import {loadAgentConfig} from "../../src/config/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

async function createTempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pixelle-agent-config-"));
}

describe("loadAgentConfig", () => {
  it("loads the repository example pixelle.toml", async () => {
    const config = await loadAgentConfig({cwd: repoRoot});

    expect(config.llm.maxRetries).toBeLessThanOrEqual(10);
  });

  it("loads TOML, resolves relative paths, and applies environment API keys", async () => {
    const cwd = await createTempWorkspace();
    process.env.PIXELLE_TEST_API_KEY = "secret-key";

    await writeFile(
      join(cwd, "pixelle.toml"),
      [
        "[llm]",
        'provider = "openai-compatible"',
        'model = "gpt-test"',
        'apiKeyEnv = "PIXELLE_TEST_API_KEY"',
        "",
        "[runtime]",
        'workspaceDir = "workspace"',
        'systemInstructions = ["Be useful."]',
        "",
        "[trace]",
        'directory = ".trace"',
      ].join("\n"),
      "utf8",
    );

    const config = await loadAgentConfig({cwd});

    expect(config.llm).toMatchObject({
      provider: "openai-compatible",
      model: "gpt-test",
      apiKey: "secret-key",
      temperature: 0.2,
    });
    expect(config.runtime.workspaceDir).toBe(join(cwd, "workspace"));
    expect(config.runtime.systemInstructions).toEqual(["Be useful."]);
    expect(config.trace.directory).toBe(join(cwd, ".trace"));
    expect(config.permissions.writeFile).toBe(false);
  });

  it("rejects invalid config values", async () => {
    const cwd = await createTempWorkspace();
    await writeFile(
      join(cwd, "pixelle.toml"),
      ["[llm]", 'provider = "openai-compatible"', 'model = ""'].join("\n"),
      "utf8",
    );

    await expect(loadAgentConfig({cwd})).rejects.toThrow();
  });

  it("rejects the removed systemPrompt field", async () => {
    const cwd = await createTempWorkspace();
    await writeFile(
      join(cwd, "pixelle.toml"),
      [
        "[llm]",
        'provider = "openai-compatible"',
        'model = "gpt-test"',
        "",
        "[runtime]",
        'systemPrompt = "legacy override"',
      ].join("\n"),
      "utf8",
    );

    await expect(loadAgentConfig({cwd})).rejects.toThrow();
  });

  it("rejects blank system instructions", async () => {
    const cwd = await createTempWorkspace();
    await writeFile(
      join(cwd, "pixelle.toml"),
      [
        "[llm]",
        'provider = "openai-compatible"',
        'model = "gpt-test"',
        "",
        "[runtime]",
        'systemInstructions = ["   "]',
      ].join("\n"),
      "utf8",
    );

    await expect(loadAgentConfig({cwd})).rejects.toThrow();
  });
});
