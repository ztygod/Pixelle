import {describe, expect, it} from "vitest";

import {TranscriptProjector} from "../src/context/index.js";
import type {LLMMessage} from "../src/llm/types.js";

describe("TranscriptProjector", () => {
  it("keeps the latest complete tool exchange and archives older results", () => {
    const transcript: LLMMessage[] = [
      {role: "system", content: "ignored"},
      {role: "user", content: "start"},
      {
        role: "assistant",
        content: "first",
        toolCalls: [{id: "call-1", name: "read", arguments: {}}],
      },
      {role: "tool", toolCallId: "call-1", name: "read", content: "old"},
      {
        role: "assistant",
        content: "second",
        toolCalls: [{id: "call-2", name: "write", arguments: {}}],
      },
      {role: "tool", toolCallId: "call-2", name: "write", content: "latest"},
    ];

    expect(new TranscriptProjector().project(transcript)).toEqual({
      messages: [
        {role: "user", content: "start"},
        {
          role: "assistant",
          content: "second",
          toolCalls: [{id: "call-2", name: "write", arguments: {}}],
        },
        {role: "tool", toolCallId: "call-2", name: "write", content: "latest"},
      ],
      archivedSections: [
        {
          id: "tool-result:call-1",
          replaceKey: "tool-result:call-1",
          title: "Tool Result: read",
          priority: 40,
          source: {kind: "tool", ref: "call-1"},
          content:
            "Tool: read\nCall ID: call-1\nArguments: {}\nAssistant: first\nResult:\nold",
        },
      ],
    });
  });

  it("preserves current behavior for an incomplete tool exchange", () => {
    const transcript: LLMMessage[] = [
      {
        role: "assistant",
        content: "incomplete",
        toolCalls: [
          {id: "call-1", name: "one", arguments: {}},
          {id: "call-2", name: "two", arguments: {}},
        ],
      },
      {role: "tool", toolCallId: "call-1", name: "one", content: "partial"},
    ];

    expect(new TranscriptProjector().project(transcript)).toEqual({
      messages: [transcript[0]],
      archivedSections: [],
    });
  });

  it("archives every result in an older multi-tool exchange", () => {
    const transcript: LLMMessage[] = [
      {
        role: "assistant",
        toolCalls: [
          {id: "old-1", name: "one", arguments: {}},
          {id: "old-2", name: "two", arguments: {}},
        ],
      },
      {role: "tool", toolCallId: "old-1", name: "one", content: "a"},
      {role: "tool", toolCallId: "old-2", name: "two", content: "b"},
      {
        role: "assistant",
        toolCalls: [{id: "new", name: "three", arguments: {}}],
      },
      {role: "tool", toolCallId: "new", name: "three", content: "c"},
    ];

    const projection = new TranscriptProjector().project(transcript);

    expect(projection.archivedSections.map((section) => section.id)).toEqual([
      "tool-result:old-1",
      "tool-result:old-2",
    ]);
    expect(projection.messages).toEqual(transcript.slice(3));
  });
});
