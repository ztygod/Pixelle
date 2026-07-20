import {describe, expect, it} from "vitest";

import {
  ContextPipeline,
  PromptAssembler,
  TranscriptBudgeter,
  createDefaultContextPipeline,
  type ContextPipelineLike,
  type TranscriptSummarizer,
  type TokenEstimator,
} from "../src/context/index.js";
import type {LLMMessage} from "../src/llm/types.js";
import type {ResolvedSystemPrompt} from "../src/agent/prompt/index.js";

const prompt: ResolvedSystemPrompt = {
  version: "pixelle-coding-agent/v1",
  sections: [
    {
      id: "core",
      title: "Core",
      content: "instructions",
      source: "core",
      locked: true,
    },
  ],
  content: "# Core\ninstructions",
};

class CountingPromptAssembler extends PromptAssembler {
  systemPromptBuilds = 0;

  override assembleSystemPrompt(
    resolvedPrompt: ResolvedSystemPrompt,
    contextText: string,
  ): string {
    this.systemPromptBuilds += 1;
    return super.assembleSystemPrompt(resolvedPrompt, contextText);
  }
}

class TrackingTranscriptBudgeter extends TranscriptBudgeter {
  compactions = 0;

  override async compact(messages: readonly LLMMessage[]) {
    this.compactions += 1;
    return {
      messages: messages.slice(-1),
      tokensBefore: 100,
      tokensAfter: 4,
      summarizedMessageCount: messages.length - 1,
    };
  }
}

describe("ContextPipeline", () => {
  it("owns request assembly and builds the final system prompt once", async () => {
    const assembler = new CountingPromptAssembler();
    const estimator: TokenEstimator = {countText: (text) => text.length};
    const pipeline: ContextPipelineLike = new ContextPipeline({
      promptAssembler: assembler,
      tokenEstimator: estimator,
    });

    const result = await pipeline.build({
      document: {
        sections: [{title: "Runtime", content: "details"}],
        transcript: [{role: "user", content: "task"}],
        metadata: {runId: "run", iteration: 1, stage: "agent"},
      },
      resolvedSystemPrompt: prompt,
      tokenLimit: 32_000,
      tools: [],
    });

    expect(assembler.systemPromptBuilds).toBe(1);
    expect(result.request.messages[0]).toEqual({
      role: "system",
      content: "# Core\ninstructions\n\n# Runtime Context\n## Runtime\ndetails",
    });
    expect(result.diagnostics.systemPromptVersion).toBe("pixelle-coding-agent/v1");
    expect(result.compacted).toBe(false);
  });

  it("keeps an explicit transcript budgeter ahead of factory summarizer options", async () => {
    const transcriptBudgeter = new TrackingTranscriptBudgeter();
    const unusedSummarizer: TranscriptSummarizer = {
      async summarize() {
        throw new Error("Factory summarizer should not replace transcriptBudgeter.");
      },
    };
    const pipeline = createDefaultContextPipeline({
      transcriptBudgeter,
      transcriptSummarizer: unusedSummarizer,
      tokenEstimator: {countText: (text) => text.length},
    });

    await pipeline.build({
      document: {
        sections: [],
        transcript: [
          {role: "user", content: "old".repeat(40)},
          {role: "user", content: "task"},
        ],
        metadata: {runId: "run", iteration: 1, stage: "agent"},
      },
      resolvedSystemPrompt: prompt,
      tokenLimit: 100,
    });

    expect(transcriptBudgeter.compactions).toBe(1);
  });
});
