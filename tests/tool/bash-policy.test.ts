import {describe, expect, it} from "vitest";

import {bashTool} from "../../src/tool/index.js";
import type {
  CommandPolicyDecision,
  CommandPolicyEvaluateInput,
  CommandPolicyLike,
  WorkspaceProfile,
} from "../../src/runtime/index.js";

const profile: WorkspaceProfile = {
  root: process.cwd(),
  packageManager: "pnpm",
  scripts: {typecheck: "tsc -b"},
  projectFiles: [],
  detectedFrameworks: [],
};

function policy(decision: CommandPolicyDecision): CommandPolicyLike {
  return {
    evaluate(_input: CommandPolicyEvaluateInput): CommandPolicyDecision {
      return decision;
    },
    canRun() {
      return {allowed: decision.allowed, reason: decision.reason};
    },
  };
}

describe("bashTool policy integration", () => {
  it("executes commands when policy allows them", async () => {
    const result = await bashTool.execute(
      {reason: "test", command: "node -e \"console.log('policy-ok')\""},
      {
        workspaceRoot: process.cwd(),
        permissions: {shell: false},
        workspaceProfile: profile,
        commandPolicy: policy({
          effect: "allow",
          allowed: true,
          risk: "low",
          category: "verification",
          ruleId: "test-allow",
          reason: "Allowed by test.",
        }),
      },
    );

    expect(result).toMatchObject({
      ok: true,
      data: {exitCode: 0},
    });
    expect(result.ok ? result.data.stdout : "").toContain("policy-ok");
  });

  it("streams stdout and stderr while executing commands", async () => {
    const streams: Array<{type: string; content: string}> = [];
    const result = await bashTool.execute(
      {
        reason: "test",
        command: "node -e \"process.stdout.write('out'); process.stderr.write('err')\"",
      },
      {
        workspaceRoot: process.cwd(),
        workspaceProfile: profile,
        commandPolicy: policy({
          effect: "allow",
          allowed: true,
          risk: "low",
          category: "verification",
          ruleId: "test-allow",
          reason: "Allowed by test.",
        }),
        emitStream: (chunk) => {
          streams.push(chunk);
        },
      },
    );

    expect(result).toMatchObject({
      ok: true,
      display: {summary: "exit 0"},
    });
    expect(streams).toEqual(
      expect.arrayContaining([
        expect.objectContaining({type: "stdout", content: "out"}),
        expect.objectContaining({type: "stderr", content: "err"}),
      ]),
    );
  });

  it("returns structured approval results without executing ask decisions", async () => {
    const result = await bashTool.execute(
      {reason: "test", command: "node -e \"throw new Error('should not run')\""},
      {
        workspaceRoot: process.cwd(),
        workspaceProfile: profile,
        commandPolicy: policy({
          effect: "ask",
          allowed: false,
          risk: "high",
          category: "dependency_mutation",
          ruleId: "test-ask",
          reason: "Needs approval.",
          approvalMessage: "Approve dependency change?",
        }),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_APPROVAL_REQUIRED",
      data: {
        decision: {
          effect: "ask",
          ruleId: "test-ask",
          approvalMessage: "Approve dependency change?",
        },
      },
    });
  });

  it("returns structured denial results without executing deny decisions", async () => {
    const result = await bashTool.execute(
      {reason: "test", command: "node -e \"throw new Error('should not run')\""},
      {
        workspaceRoot: process.cwd(),
        workspaceProfile: profile,
        commandPolicy: policy({
          effect: "deny",
          allowed: false,
          risk: "critical",
          category: "destructive_fs",
          ruleId: "test-deny",
          reason: "Blocked.",
        }),
      },
    );

    expect(result).toMatchObject({
      ok: false,
      code: "TOOL_COMMAND_POLICY_DENIED",
      data: {
        decision: {
          effect: "deny",
          ruleId: "test-deny",
        },
      },
    });
  });
});
