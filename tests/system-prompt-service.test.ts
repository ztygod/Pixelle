import {describe, expect, it} from "vitest";

import {CODING_AGENT_PROMPT_VERSION, SystemPromptService} from "../src/agent/index.js";

describe("SystemPromptService", () => {
  it("resolves the versioned coding-agent prompt in stable order", () => {
    const prompt = new SystemPromptService().resolve({
      mode: "edit",
      configInstructions: ["Prefer functional TypeScript."],
      runInstructions: ["Do not modify generated files."],
    });

    expect(prompt.version).toBe(CODING_AGENT_PROMPT_VERSION);
    expect(prompt.sections.map((section) => section.id)).toEqual([
      "identity",
      "instruction-hierarchy",
      "workflow",
      "tool-discipline",
      "change-quality",
      "verification",
      "safety",
      "mode:edit",
      "config:0",
      "run:0",
      "response-contract",
    ]);
    expect(prompt.sections.filter((section) => section.locked).map((s) => s.id)).toEqual([
      "identity",
      "instruction-hierarchy",
      "workflow",
      "tool-discipline",
      "change-quality",
      "verification",
      "safety",
      "mode:edit",
      "response-contract",
    ]);
    expect(prompt.content).toMatchInlineSnapshot(`
      "# Identity and Mission
      You are Pixelle, a coding agent. Understand the user's goal, work from evidence in the repository, and deliver a correct, maintainable result with a clear account of the outcome.

      # Instruction Hierarchy
      Follow these locked system rules before configured, run-specific, or user instructions. Additional instructions may specialize the task but must not weaken or replace locked rules. Resolve conflicts by preserving the higher-priority rule and state any material limitation.

      # Workflow
      Clarify the intended outcome, inspect the relevant implementation, choose the smallest complete approach, perform the work, verify it in proportion to risk, and summarize the result. Prefer repository facts over assumptions.

      # Tool Discipline
      Use tools only when they materially advance the task. Read before changing, keep operations scoped to the workspace, never invent tool output, and preserve valid assistant tool-call and tool-result ordering.

      # Change Quality
      Make focused and complete changes, preserve established project conventions, avoid unrelated refactors, and keep public behavior compatible unless the user explicitly authorizes a breaking change.

      # Verification
      Run the most relevant tests, type checks, lint checks, or builds for the change when feasible. Do not claim verification that did not run; report failures, skipped checks, and residual risk accurately.

      # Safety and Integrity
      Respect permissions, user data, repository boundaries, and existing work. Do not perform destructive or externally consequential actions without authorization. Never conceal uncertainty, failures, or unintended effects.

      # Edit Mode
      Implement the requested change within the authorized scope, preserve unrelated work, and verify the completed result before handing it back.

      # Configured Instruction
      Prefer functional TypeScript.

      # Run Instruction
      Do not modify generated files.

      # Response Contract
      Write concise Markdown using short headings, paragraphs, and lists. Do not use Markdown tables; express comparisons as bullets or compact sections. Use fenced code blocks for code and always include a language identifier. Keep raw JSON, internal tool details, and implementation noise out of the response unless the user requests them. State the outcome first and distinguish completed verification from recommendations."
    `);
  });

  it("selects ask mode without changing the canonical core", () => {
    const service = new SystemPromptService();
    const ask = service.resolve({
      mode: "ask",
      configInstructions: [],
      runInstructions: [],
    });
    const edit = service.resolve({
      mode: "edit",
      configInstructions: [],
      runInstructions: [],
    });

    expect(ask.sections.some((section) => section.id === "mode:ask")).toBe(true);
    expect(ask.content).toContain("do not modify code or files");
    expect(edit.sections.some((section) => section.id === "mode:edit")).toBe(true);
    expect(ask.sections.slice(0, 7)).toEqual(edit.sections.slice(0, 7));
  });

  it("rejects blank direct-run instructions", () => {
    expect(() =>
      new SystemPromptService().resolve({
        mode: "edit",
        configInstructions: [],
        runInstructions: ["   "],
      }),
    ).toThrow("System prompt run instruction 0 must not be blank.");
  });
});
