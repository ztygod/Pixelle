import {describe, expect, it} from "vitest";

import {buildSystemPrompt} from "../../src/agent/context.js";
import type {AgentRunContext} from "../../src/agent/index.js";

describe("buildSystemPrompt", () => {
  it("adds CLI markdown output instructions", () => {
    const prompt = buildSystemPrompt(
      {
        input: {prompt: "test"},
        config: {
          runtime: {
            systemPrompt: "Base prompt.",
            workspaceDir: ".",
            maxIterations: 1,
            maxRepairAttempts: 0,
            tokensLimit: 1000,
            rollbackOnFailure: false,
          },
        },
      } as AgentRunContext,
      "",
    );

    expect(prompt).toContain("Base prompt.");
    expect(prompt).toContain("Do not use Markdown tables");
    expect(prompt).toContain("always include a language identifier");
  });
});
