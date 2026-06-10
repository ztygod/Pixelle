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
});
