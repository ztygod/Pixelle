import {mkdtemp, writeFile} from "node:fs/promises";
import {join} from "node:path";
import {tmpdir} from "node:os";

import {describe, expect, it} from "vitest";

import {loadAgentConfig} from "../../src/config/index.js";

async function createTempWorkspace(): Promise<string> {
  return mkdtemp(join(tmpdir(), "pixelle-agent-config-"));
}

describe("loadAgentConfig", () => {
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
        'systemPrompt = "Be useful."',
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
});
