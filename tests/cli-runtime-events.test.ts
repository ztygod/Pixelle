import {describe, expect, it} from "vitest";

import {agentEventToCliEvent} from "../src/cli/runtime-events.js";
import type {PixelleEvent} from "../src/events/index.js";

describe("agentEventToCliEvent", () => {
  it("maps applied change sets with diff content", () => {
    const event: PixelleEvent = {
      type: "change_set.applied",
      id: "change-1",
      files: ["src/app.ts"],
      changes: [
        {
          path: "src/app.ts",
          status: "modified",
          beforeContent: "const value = 1;\n",
          afterContent: "const value = 2;\n",
        },
      ],
      checkpointPath: ".pixelle/checkpoints/change-1.json",
    };

    expect(agentEventToCliEvent(event)).toMatchObject({
      type: "change_set",
      id: "change-1",
      files: [
        {
          path: "src/app.ts",
          status: "modified",
          beforeContent: "const value = 1;\n",
          afterContent: "const value = 2;\n",
        },
      ],
      checkpointPath: ".pixelle/checkpoints/change-1.json",
    });
  });

  it("maps verification and trace events", () => {
    expect(
      agentEventToCliEvent({
        type: "verification.completed",
        passed: true,
        commands: ["pnpm test"],
      }),
    ).toMatchObject({
      type: "verification",
      status: "passed",
      commands: ["pnpm test"],
    });

    expect(
      agentEventToCliEvent({
        type: "trace.persisted",
        path: ".pixelle/run.json",
      }),
    ).toMatchObject({
      type: "trace",
      path: ".pixelle/run.json",
    });
  });

  it("preserves structured tool failure details", () => {
    const event: PixelleEvent = {
      type: "tool.call_failed",
      id: "call-1",
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
    };

    expect(agentEventToCliEvent(event)).toMatchObject({
      type: "tool_error",
      id: "call-1",
      name: "bash",
      error: "Command requires user confirmation.",
      code: "TOOL_APPROVAL_REQUIRED",
      data: {
        decision: {
          risk: "high",
          category: "dependency_mutation",
          approvalMessage: "Allow dependency changes?",
        },
      },
    });
  });
});
