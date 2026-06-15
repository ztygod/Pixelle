import type {WorkspaceProfile} from "../types.js";

/** The runtime action a caller should take for a policy decision. */
export type PolicyEffect = "allow" | "ask" | "deny";

/** Coarse risk levels used by tools, approval UIs, and audit records. */
export type PolicyRisk = "low" | "medium" | "high" | "critical";

/** Stable command buckets exposed to callers without leaking rule internals. */
export type CommandCategory =
  | "verification"
  | "format"
  | "git_read"
  | "git_write"
  | "dependency_mutation"
  | "network"
  | "destructive_fs"
  | "shell_composition"
  | "unknown";

export type PolicySource = "bash" | "verifier" | "git" | "dependency" | "runtime";

export type ApprovalMode = "disabled" | "manual";

export type WorkspaceTrustLevel = "untrusted" | "trusted";

/** Input shared by command-capable runtime tools before execution. */
export type CommandPolicyEvaluateInput = {
  command: string;
  cwd?: string;
  profile?: WorkspaceProfile;
  source?: PolicySource;
  approvalMode?: ApprovalMode;
  trustLevel?: WorkspaceTrustLevel;
};

/** Lightweight shell shape used for policy checks; this is not a full shell AST. */
export type ParsedCommand = {
  raw: string;
  normalized: string;
  executable?: string;
  args: string[];
  hasControlOperator: boolean;
  hasPipe: boolean;
  hasRedirection: boolean;
  hasCommandSubstitution: boolean;
  segments: string[];
};

export type CommandClassification = {
  category: CommandCategory;
  risk: PolicyRisk;
};

/** The final policy output consumed by tools and future approval flows. */
export type CommandPolicyDecision = {
  effect: PolicyEffect;
  allowed: boolean;
  risk: PolicyRisk;
  category: CommandCategory;
  ruleId: string;
  reason: string;
  approvalMessage?: string;
  metadata?: Record<string, unknown>;
};

/** Backward-compatible allow/deny result for older verifier call sites. */
export type CommandPolicyCompatDecision = {
  allowed: boolean;
  reason?: string;
};

/** Rule evaluation context after parsing and classification. */
export type CommandPolicyContext = Required<
  Pick<CommandPolicyEvaluateInput, "source" | "approvalMode" | "trustLevel">
> &
  Omit<CommandPolicyEvaluateInput, "source" | "approvalMode" | "trustLevel"> & {
    parsed: ParsedCommand;
    classification: CommandClassification;
  };

/** A single ordered policy rule in the default-deny decision pipeline. */
export type CommandPolicyRule = {
  id: string;
  description: string;
  match(context: CommandPolicyContext): boolean;
  decide(context: CommandPolicyContext): CommandPolicyDecision;
};

export type CommandPolicyOptions = {
  rules?: readonly CommandPolicyRule[];
};

export type CommandPolicyLike = {
  evaluate(input: CommandPolicyEvaluateInput): CommandPolicyDecision;
  canRun(command: string, profile?: WorkspaceProfile): CommandPolicyCompatDecision;
};
