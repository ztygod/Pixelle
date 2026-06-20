import {createCommandPolicy, type CommandPolicyLike} from "../../runtime/index.js";
import type {ToolPermissions} from "../../tool/index.js";
import {mergePermissions} from "../runtime-utils.js";
import type {AgentRuntimeConfig} from "../types.js";

/** Policy inputs used to normalize permissions and command execution rules. */
export type RuntimePolicyOptions = {
  /** Agent-level permission defaults from normalized config. */
  config: AgentRuntimeConfig["permissions"];
  /** Optional caller override merged on top of configured permissions. */
  permissions?: ToolPermissions;
  /** Optional command policy implementation for shell and verification commands. */
  commandPolicy?: CommandPolicyLike;
};

/** Central policy object for permissions, command checks, and future approvals. */
export class RuntimePolicy {
  /** Command policy used by shell tools and verification. */
  readonly commandPolicy: CommandPolicyLike;
  private readonly permissions: ToolPermissions;

  /** Creates a policy with merged tool permissions and command policy defaults. */
  constructor(options: RuntimePolicyOptions) {
    this.permissions = mergePermissions(options.config, options.permissions);
    this.commandPolicy = options.commandPolicy ?? createCommandPolicy();
  }

  /** Resolves tool permissions for a run by applying per-run overrides last. */
  toolPermissions(runPermissions?: ToolPermissions): ToolPermissions {
    return mergePermissions(this.permissions, runPermissions);
  }
}

/** Creates the default runtime policy. */
export function createRuntimePolicy(options: RuntimePolicyOptions): RuntimePolicy {
  return new RuntimePolicy(options);
}
