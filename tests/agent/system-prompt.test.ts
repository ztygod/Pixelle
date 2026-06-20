import {describe, expect, it} from "vitest";

import {Agent} from "../../src/agent/index.js";
import {BaseLLMClient} from "../../src/llm/index.js";
import type {LLMGenerateInput, LLMResponse} from "../../src/llm/types.js";
import type {WorkspaceProfile} from "../../src/runtime/index.js";

class CapturingLLMClient extends BaseLLMClient {
  request: LLMGenerateInput | undefined;

  override async generate(input: LLMGenerateInput): Promise<LLMResponse> {
    this.request = input;
    return {content: "Done.", toolCalls: []};
  }
}

describe("ContextManager system prompt", () => {
  it("adds CLI markdown output instructions", async () => {
    const workspaceRoot = process.cwd();
    const llm = new CapturingLLMClient();
    const profile: WorkspaceProfile = {
      root: workspaceRoot,
      packageManager: "pnpm",
      scripts: {},
      projectFiles: [],
      detectedFrameworks: [],
    };

    await new Agent({
      config: {
        runtime: {
          systemPrompt: "Base prompt.",
          workspaceDir: workspaceRoot,
          maxIterations: 1,
          maxRepairAttempts: 0,
          tokensLimit: 1000,
          rollbackOnFailure: false,
        },
        permissions: {
          readFile: true,
          writeFile: false,
          network: false,
          shell: false,
        },
        verification: {
          enabled: false,
          commands: [],
        },
        trace: {
          enabled: false,
          directory: workspaceRoot,
        },
      },
      llm,
      workspaceScanner: {
        async scan(): Promise<WorkspaceProfile> {
          return profile;
        },
      },
    }).run({prompt: "test"});

    const prompt = llm.request?.messages[0]?.content;

    expect(prompt).toContain("Base prompt.");
    expect(prompt).toContain("Do not use Markdown tables");
    expect(prompt).toContain("always include a language identifier");
  });
});
