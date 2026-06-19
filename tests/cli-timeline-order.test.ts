import {describe, expect, it} from "vitest";

import {initialCliState, reduceCliState} from "../src/cli/state/cli-state.js";
import {selectTimelineItems} from "../src/cli/state/timeline.js";

describe("CLI timeline ordering", () => {
  it("places assistant output after tools when the final delta arrives later", () => {
    const state = [
      {
        type: "assistant_stage" as const,
        messageId: "run-1",
        stage: "thinking" as const,
        createdAt: 1,
      },
      {
        type: "tool_start" as const,
        id: "tool-1",
        name: "read_file",
        createdAt: 2,
      },
      {
        type: "tool_done" as const,
        id: "tool-1",
        name: "read_file",
        createdAt: 3,
      },
      {
        type: "assistant_delta" as const,
        messageId: "run-1",
        delta: "The file contains the requested code.",
        stage: "complete" as const,
        createdAt: 4,
      },
    ].reduce(
      (current, event) => reduceCliState(current, {type: "event", event}),
      initialCliState,
    );

    expect(selectTimelineItems(state).map((item) => item.kind)).toEqual([
      "tool",
      "message",
    ]);
  });

  it("stores structured tool failure details in tool state", () => {
    const state = [
      {
        type: "tool_start" as const,
        id: "tool-1",
        name: "bash",
        input: {command: "pnpm add left-pad"},
        createdAt: 1,
      },
      {
        type: "tool_error" as const,
        id: "tool-1",
        name: "bash",
        error: "Command requires user confirmation.",
        code: "TOOL_APPROVAL_REQUIRED",
        data: {
          decision: {
            effect: "ask",
            risk: "high",
            category: "dependency_mutation",
            ruleId: "dependency-mutation",
            approvalMessage: "Allow dependency changes?",
          },
        },
        createdAt: 2,
      },
    ].reduce(
      (current, event) => reduceCliState(current, {type: "event", event}),
      initialCliState,
    );

    expect(state.tools[0]).toMatchObject({
      status: "error",
      errorCode: "TOOL_APPROVAL_REQUIRED",
      errorData: {
        decision: {
          risk: "high",
          category: "dependency_mutation",
          approvalMessage: "Allow dependency changes?",
        },
      },
    });
  });

  it("appends tool stream chunks to the existing timeline item", () => {
    const state = [
      {
        type: "tool_start" as const,
        id: "tool-1",
        name: "bash",
        input: {command: "pnpm test"},
        createdAt: 1,
      },
      {
        type: "tool_stream" as const,
        id: "tool-1",
        name: "bash",
        stream: {type: "stdout" as const, content: "running\n"},
        createdAt: 2,
      },
      {
        type: "tool_stream" as const,
        id: "tool-1",
        name: "bash",
        stream: {type: "stderr" as const, content: "warning\n"},
        createdAt: 3,
      },
      {
        type: "tool_done" as const,
        id: "tool-1",
        name: "bash",
        summary: "Executed shell command.",
        display: {summary: "exit 0"},
        createdAt: 4,
      },
    ].reduce(
      (current, event) => reduceCliState(current, {type: "event", event}),
      initialCliState,
    );

    expect(selectTimelineItems(state)).toHaveLength(1);
    expect(state.tools[0]).toMatchObject({
      status: "success",
      display: {summary: "exit 0"},
      streams: [
        {type: "stdout", content: "running\n"},
        {type: "stderr", content: "warning\n"},
      ],
    });
  });

  it("reduces direct Pixelle tool events without the CliEvent adapter", () => {
    const state = [
      {
        type: "tool.call_started" as const,
        id: "tool-1",
        name: "grep",
        input: {pattern: "ToolResult"},
        createdAt: 1,
      },
      {
        type: "tool.call_stream" as const,
        id: "tool-1",
        name: "grep",
        stream: {type: "progress" as const, label: "searching", percent: 50},
        createdAt: 2,
      },
      {
        type: "tool.call_completed" as const,
        id: "tool-1",
        name: "grep",
        result: {
          ok: true as const,
          message: "Searched workspace file contents.",
          data: {matches: []},
          display: {
            kind: "search" as const,
            target: "ToolResult",
            summary: "0 matches",
          },
        },
        durationMs: 12,
        createdAt: 3,
      },
    ].reduce(
      (current, event) => reduceCliState(current, {type: "event", event}),
      initialCliState,
    );

    expect(selectTimelineItems(state)).toHaveLength(1);
    expect(state.tools[0]).toMatchObject({
      status: "success",
      target: "ToolResult",
      result: {
        ok: true,
        message: "Searched workspace file contents.",
      },
      display: {
        kind: "search",
        target: "ToolResult",
        summary: "0 matches",
      },
      durationMs: 12,
      streams: [{type: "progress", label: "searching", percent: 50}],
    });
  });

  it("stores the tool target across the tool lifecycle", () => {
    const state = [
      {
        type: "tool_start" as const,
        id: "tool-1",
        name: "read_file",
        target: "src/cli/types.ts",
        input: {path: "src/cli/types.ts"},
        createdAt: 1,
      },
      {
        type: "tool_done" as const,
        id: "tool-1",
        name: "read_file",
        summary: "Read file content.",
        createdAt: 2,
      },
    ].reduce(
      (current, event) => reduceCliState(current, {type: "event", event}),
      initialCliState,
    );

    expect(state.tools[0]).toMatchObject({
      status: "success",
      target: "src/cli/types.ts",
    });
  });
});
