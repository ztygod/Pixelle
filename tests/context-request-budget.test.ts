import {describe, expect, it} from "vitest";

import {
  ContextBudgeter,
  DefaultContextBudgetPolicy,
  TranscriptBudgeter,
  estimateRequestTokens,
  type TokenEstimator,
} from "../src/context/index.js";
import type {LLMMessage, LLMTool} from "../src/llm/types.js";

const charEstimator: TokenEstimator = {
  countText: (text) => text.length,
};

describe("complete model request budgeting", () => {
  it("subtracts system, transcript, tool schemas, overhead, output, and safety from sections", () => {
    const transcript: LLMMessage[] = [{role: "user", content: "t".repeat(18_000)}];
    const tools: LLMTool[] = [
      {name: "large", description: "s".repeat(4_900), inputSchema: {type: "object"}},
    ];
    const budgeted = new ContextBudgeter({tokenEstimator: charEstimator}).budget(
      {
        sections: [{content: "r".repeat(25_000)}],
        transcript,
        metadata: {runId: "budget", iteration: 1, stage: "agent"},
      },
      {messages: transcript, archivedSections: []},
      32_000,
      "y".repeat(3_000),
      tools,
    );

    expect(budgeted.budget.reservedOutputTokens).toBe(4_000);
    expect(budgeted.budget.safetyMarginTokens).toBe(560);
    expect(budgeted.budget.availableSectionTokens).toBeLessThan(2_000);
    expect(budgeted.budget.availableSectionTokens).toBe(
      Math.max(
        0,
        budgeted.budget.hardInputLimit -
          budgeted.budget.systemPromptTokens -
          budgeted.budget.transcriptTokens -
          budgeted.budget.toolSchemaTokens -
          budgeted.budget.requestOverheadTokens,
      ),
    );
  });

  it("counts assistant tool arguments, tool results, and schemas", () => {
    const messages: LLMMessage[] = [
      {
        role: "assistant",
        content: "calling",
        toolCalls: [{id: "call-1", name: "read", arguments: {path: "x".repeat(100)}}],
      },
      {role: "tool", toolCallId: "call-1", name: "read", content: "result".repeat(20)},
    ];
    const tools: LLMTool[] = [
      {name: "read", description: "description", inputSchema: {type: "object"}},
    ];
    const estimate = estimateRequestTokens(charEstimator, messages, tools);

    expect(estimate.messageTokens).toBeGreaterThan(250);
    expect(estimate.toolSchemaTokens).toBeGreaterThan(0);
    expect(estimate.overheadTokens).toBeGreaterThan(0);
    expect(estimate.totalTokens).toBe(
      estimate.messageTokens + estimate.toolSchemaTokens + estimate.overheadTokens,
    );
  });

  it("summarizes only the old prefix and preserves the latest complete tool exchange", async () => {
    const messages: LLMMessage[] = [
      {role: "user", content: "old request".repeat(20)},
      {role: "assistant", content: "old response".repeat(20)},
      {role: "user", content: "current task"},
      {
        role: "assistant",
        toolCalls: [{id: "latest", name: "read", arguments: {path: "a.ts"}}],
      },
      {role: "tool", toolCallId: "latest", name: "read", content: "latest result"},
    ];
    const result = await new TranscriptBudgeter({tokenEstimator: charEstimator}).compact(
      messages,
      120,
    );

    expect(result.summarizedMessageCount).toBe(2);
    expect(result.messages.slice(-3)).toEqual(messages.slice(-3));
    expect(result.messages.some((message) => message.role === "tool")).toBe(true);
  });

  it("keeps legacy maxInputTokens while exposing the new section budget", () => {
    const budget = new DefaultContextBudgetPolicy({reservedOutputTokens: 0}).createBudget(
      {
        tokenLimit: 10_000,
      },
    );
    expect(budget.maxInputTokens).toBe(10_000);
    expect(budget.availableSectionTokens).toBe(budget.hardInputLimit);
  });
});
