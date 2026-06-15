import type {WorkspaceProfile} from "../types.js";
import {classifyCommand} from "./command-classifier.js";
import {parseCommand} from "./command-parser.js";
import {createDefaultRules} from "./rules/index.js";
import type {
  CommandPolicyCompatDecision,
  CommandPolicyDecision,
  CommandPolicyEvaluateInput,
  CommandPolicyLike,
  CommandPolicyOptions,
  CommandPolicyRule,
} from "./types.js";

/** Default command policy facade used by runtime tools before command execution. */
export class CommandPolicy implements CommandPolicyLike {
  private readonly rules: readonly CommandPolicyRule[];

  constructor(options: CommandPolicyOptions = {}) {
    this.rules = options.rules ?? createDefaultRules();
  }

  /** Parse, classify, then return the first matching ordered rule decision. */
  evaluate(input: CommandPolicyEvaluateInput): CommandPolicyDecision {
    const parsed = parseCommand(input.command);
    const classification = classifyCommand(parsed, input.profile);
    const context = {
      ...input,
      approvalMode: input.approvalMode ?? "disabled",
      source: input.source ?? "runtime",
      trustLevel: input.trustLevel ?? "untrusted",
      parsed,
      classification,
    };

    for (const rule of this.rules) {
      if (rule.match(context)) {
        return rule.decide(context);
      }
    }

    return {
      effect: "deny",
      allowed: false,
      risk: classification.risk,
      category: classification.category,
      ruleId: "policy-fallback",
      reason: "Command was denied by the default policy.",
    };
  }

  /** Compatibility API for older boolean allow/deny call sites. */
  canRun(command: string, profile?: WorkspaceProfile): CommandPolicyCompatDecision {
    const decision = this.evaluate({
      command,
      profile,
      source: "verifier",
      approvalMode: "disabled",
      trustLevel: "untrusted",
    });

    return {
      allowed: decision.allowed,
      ...(decision.allowed ? {} : {reason: decision.reason}),
    };
  }
}

/** Factory kept as the stable public entrypoint for policy construction. */
export function createCommandPolicy(options: CommandPolicyOptions = {}): CommandPolicy {
  return new CommandPolicy(options);
}

export type {
  CommandPolicyCompatDecision,
  CommandPolicyDecision,
  CommandPolicyEvaluateInput,
  CommandPolicyLike,
  CommandPolicyOptions,
};
