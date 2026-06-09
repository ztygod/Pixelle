import type {WorkspaceProfile} from "./types.js";

export type CommandPolicyDecision = {
  allowed: boolean;
  reason?: string;
};

const DANGEROUS_PATTERNS = [
  /\brm\s+-/i,
  /\bdel\s+/i,
  /\brmdir\s+/i,
  /\bgit\s+reset\b/i,
  /\bgit\s+checkout\s+--\b/i,
  /\bshutdown\b/i,
];

export class CommandPolicy {
  canRun(command: string, profile?: WorkspaceProfile): CommandPolicyDecision {
    const normalized = command.trim();
    if (!normalized) {
      return {allowed: false, reason: "Command is empty."};
    }

    if (DANGEROUS_PATTERNS.some((pattern) => pattern.test(normalized))) {
      return {allowed: false, reason: "Command is blocked by the safety policy."};
    }

    if (isPackageScriptCommand(normalized, profile)) {
      return {allowed: true};
    }

    if (/^(pnpm|npm|yarn)\s+(install|add|remove)\b/i.test(normalized)) {
      return {
        allowed: false,
        reason: "Dependency mutation commands require explicit user approval.",
      };
    }

    return {
      allowed: false,
      reason: "Only workspace verification scripts are allowed by default.",
    };
  }
}

function isPackageScriptCommand(command: string, profile?: WorkspaceProfile): boolean {
  if (!profile) {
    return /^(pnpm|npm|yarn)\s+(run\s+)?(typecheck|build|test|lint)\b/i.test(command);
  }

  const scriptNames = new Set(Object.keys(profile.scripts));
  for (const candidate of ["typecheck", "build", "test", "lint"]) {
    if (!scriptNames.has(candidate)) {
      continue;
    }

    if (matchesScriptCommand(command, profile.packageManager ?? "npm", candidate)) {
      return true;
    }
  }

  return false;
}

function matchesScriptCommand(
  command: string,
  packageManager: NonNullable<WorkspaceProfile["packageManager"]>,
  script: string,
): boolean {
  if (packageManager === "npm") {
    return new RegExp(`^npm\\s+run\\s+${escapeRegex(script)}\\b`, "i").test(command);
  }

  return new RegExp(
    `^${escapeRegex(packageManager)}\\s+(run\\s+)?${escapeRegex(script)}\\b`,
    "i",
  ).test(command);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

