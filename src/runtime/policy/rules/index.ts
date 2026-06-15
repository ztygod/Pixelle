import {classifyCommandFromSegment, segmentCategories} from "../command-classifier.js";
import type {
  CommandCategory,
  CommandPolicyContext,
  CommandPolicyDecision,
  CommandPolicyRule,
  PolicyEffect,
  PolicyRisk,
} from "../types.js";

const INTERPRETERS = new Set([
  "bash",
  "sh",
  "zsh",
  "fish",
  "powershell",
  "pwsh",
  "python",
  "python3",
  "node",
  "ruby",
  "perl",
]);

/** Rules are ordered from most dangerous/specific to default-deny fallback. */
export function createDefaultRules(): CommandPolicyRule[] {
  return [
    emptyCommandRule,
    dangerousCommandRule,
    unsafeShellCompositionRule,
    verificationRule,
    gitReadRule,
    formatRule,
    dependencyMutationRule,
    gitWriteRule,
    networkRule,
    unknownCommandRule,
  ];
}

const emptyCommandRule: CommandPolicyRule = {
  id: "empty-command",
  description: "Reject empty commands.",
  match: (context) => !context.parsed.normalized,
  decide: () =>
    decision({
      effect: "deny",
      risk: "critical",
      category: "unknown",
      ruleId: "empty-command",
      reason: "Command is empty.",
    }),
};

const dangerousCommandRule: CommandPolicyRule = {
  id: "dangerous-command",
  description: "Reject commands with well-known destructive behavior.",
  match: (context) => isDangerous(context),
  decide: (context) =>
    decision({
      effect: "deny",
      risk: "critical",
      category: context.classification.category,
      ruleId: "dangerous-command",
      reason: "Command is blocked by the safety policy.",
    }),
};

const unsafeShellCompositionRule: CommandPolicyRule = {
  id: "unsafe-shell-composition",
  description: "Conservatively gate shell control operators and composition.",
  match: (context) => context.classification.category === "shell_composition",
  decide: (context) => {
    if (isDangerousComposition(context)) {
      return decision({
        effect: "deny",
        risk: "critical",
        category: "shell_composition",
        ruleId: "unsafe-shell-composition",
        reason: "Shell composition contains a dangerous command pattern.",
      });
    }

    return decision({
      effect: "ask",
      risk: "high",
      category: "shell_composition",
      ruleId: "unsafe-shell-composition",
      reason: "Shell composition requires user confirmation.",
      approvalMessage: `Allow composed shell command?\n\n${context.command}`,
      metadata: {
        segments: context.parsed.segments,
        segmentCategories: segmentCategories(context.parsed.segments, context.profile),
      },
    });
  },
};

const verificationRule: CommandPolicyRule = {
  id: "verification-script",
  description: "Allow known workspace verification scripts.",
  match: (context) => context.classification.category === "verification",
  decide: (context) =>
    decision({
      effect: "allow",
      risk: "low",
      category: "verification",
      ruleId: "verification-script",
      reason: "Workspace verification scripts are allowed by default.",
      metadata: {script: context.parsed.args.join(" ")},
    }),
};

const gitReadRule: CommandPolicyRule = {
  id: "git-read",
  description: "Allow read-only Git inspection commands.",
  match: (context) => context.classification.category === "git_read",
  decide: () =>
    decision({
      effect: "allow",
      risk: "low",
      category: "git_read",
      ruleId: "git-read",
      reason: "Read-only Git commands are allowed by default.",
    }),
};

const formatRule: CommandPolicyRule = {
  id: "format-command",
  description: "Require confirmation for formatting commands that may edit files.",
  match: (context) => context.classification.category === "format",
  decide: (context) =>
    decision({
      effect: "ask",
      risk: "medium",
      category: "format",
      ruleId: "format-command",
      reason: "Formatting commands may modify workspace files.",
      approvalMessage: `Allow formatting command to run?\n\n${context.command}`,
    }),
};

const dependencyMutationRule: CommandPolicyRule = {
  id: "dependency-mutation",
  description: "Require confirmation for dependency mutations.",
  match: (context) => context.classification.category === "dependency_mutation",
  decide: (context) =>
    decision({
      effect: "ask",
      risk: "high",
      category: "dependency_mutation",
      ruleId: "dependency-mutation",
      reason: "Dependency mutation commands require user confirmation.",
      approvalMessage: `Allow dependency changes?\n\n${context.command}`,
    }),
};

const gitWriteRule: CommandPolicyRule = {
  id: "git-write",
  description: "Require confirmation for Git commands that may change state.",
  match: (context) => context.classification.category === "git_write",
  decide: (context) =>
    decision({
      effect: "ask",
      risk: context.classification.risk,
      category: "git_write",
      ruleId: "git-write",
      reason: "Git write commands require user confirmation.",
      approvalMessage: `Allow Git command that may change repository state?\n\n${context.command}`,
    }),
};

const networkRule: CommandPolicyRule = {
  id: "network-command",
  description: "Require confirmation for network-capable commands.",
  match: (context) => context.classification.category === "network",
  decide: (context) =>
    decision({
      effect: "ask",
      risk: "high",
      category: "network",
      ruleId: "network-command",
      reason: "Network commands require user confirmation.",
      approvalMessage: `Allow network command?\n\n${context.command}`,
    }),
};

const unknownCommandRule: CommandPolicyRule = {
  id: "unknown-command",
  description: "Deny commands that are not explicitly classified as safe.",
  match: () => true,
  decide: (context) =>
    decision({
      effect: "deny",
      risk: context.classification.risk,
      category: context.classification.category,
      ruleId: "unknown-command",
      reason: "Unknown commands are denied by default.",
    }),
};

function decision(input: {
  effect: PolicyEffect;
  risk: PolicyRisk;
  category: CommandCategory;
  ruleId: string;
  reason: string;
  approvalMessage?: string;
  metadata?: Record<string, unknown>;
}): CommandPolicyDecision {
  return {
    ...input,
    allowed: input.effect === "allow",
  };
}

/** Catches known destructive commands even when classification is incomplete. */
function isDangerous(context: CommandPolicyContext): boolean {
  const command = context.parsed.normalized.toLowerCase();

  return (
    /\brm\s+-(?:[^\s]*r[^\s]*f|[^\s]*f[^\s]*r)\b/.test(command) ||
    /\b(?:del|erase)\s+/.test(command) ||
    /\b(?:rmdir|rd)\s+/.test(command) ||
    /\bremove-item\b.*\s-(?:recurse|r)\b/i.test(command) ||
    /\bshutdown\b/.test(command) ||
    /\bgit\s+reset\b.*\s--hard\b/.test(command) ||
    /\bgit\s+clean\b.*\s-[^\s]*f[^\s]*d/.test(command) ||
    /\bcurl\b.+\|\s*(?:bash|sh|zsh|pwsh|powershell)\b/.test(command) ||
    /\bwget\b.+\|\s*(?:bash|sh|zsh|pwsh|powershell)\b/.test(command)
  );
}

/** Treats shell composition as high risk, with interpreter pipes blocked. */
function isDangerousComposition(context: CommandPolicyContext): boolean {
  if (context.parsed.hasCommandSubstitution) {
    return true;
  }

  if (context.parsed.hasPipe) {
    const lastSegment = context.parsed.segments.at(-1);
    const executable = lastSegment
      ? classifyCommandFromSegment(lastSegment, context.profile)
      : undefined;
    const lastCommand = lastSegment?.trim().split(/\s+/)[0]?.toLowerCase();
    if (lastCommand && INTERPRETERS.has(lastCommand)) {
      return true;
    }
    if (executable?.category === "destructive_fs") {
      return true;
    }
  }

  return context.parsed.segments.some((segment) =>
    isDangerous({
      ...context,
      command: segment,
      parsed: {
        raw: segment,
        normalized: segment.trim(),
        executable: undefined,
        args: [],
        hasControlOperator: false,
        hasPipe: false,
        hasRedirection: false,
        hasCommandSubstitution: false,
        segments: [segment],
      },
    }),
  );
}
