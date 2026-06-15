import type {WorkspaceProfile} from "../types.js";
import {tokenize} from "./command-parser.js";
import type {
  CommandCategory,
  CommandClassification,
  ParsedCommand,
  PolicyRisk,
} from "./types.js";

const VERIFICATION_SCRIPTS = new Set(["typecheck", "build", "test", "lint"]);
const FORMAT_SCRIPTS = new Set(["format", "format:fix", "lint:fix"]);
const PACKAGE_MANAGERS = new Set(["pnpm", "npm", "yarn"]);
const DEPENDENCY_MUTATIONS = new Set(["add", "install", "remove", "uninstall", "update"]);
const GIT_READ_COMMANDS = new Set(["status", "diff", "log", "show", "branch"]);
const GIT_WRITE_COMMANDS = new Set([
  "add",
  "branch",
  "commit",
  "checkout",
  "clean",
  "merge",
  "pull",
  "push",
  "rebase",
  "reset",
  "restore",
  "stash",
  "switch",
  "tag",
]);
const NETWORK_COMMANDS = new Set([
  "curl",
  "wget",
  "ssh",
  "scp",
  "sftp",
  "invoke-webrequest",
  "iwr",
]);
const DESTRUCTIVE_FS_COMMANDS = new Set([
  "rm",
  "del",
  "erase",
  "rmdir",
  "rd",
  "remove-item",
  "shutdown",
]);

/** Assigns a broad category and baseline risk before ordered rules decide. */
export function classifyCommand(
  parsed: ParsedCommand,
  profile?: WorkspaceProfile,
): CommandClassification {
  if (!parsed.normalized) {
    return {category: "unknown", risk: "critical"};
  }

  if (
    parsed.hasControlOperator ||
    parsed.hasPipe ||
    parsed.hasRedirection ||
    parsed.hasCommandSubstitution
  ) {
    return {category: "shell_composition", risk: "high"};
  }

  const executable = parsed.executable;
  if (!executable) {
    return {category: "unknown", risk: "medium"};
  }

  if (DESTRUCTIVE_FS_COMMANDS.has(executable)) {
    return {category: "destructive_fs", risk: "critical"};
  }

  if (isPackageScript(parsed, profile, VERIFICATION_SCRIPTS)) {
    return {category: "verification", risk: "low"};
  }

  if (
    isPackageScript(parsed, profile, FORMAT_SCRIPTS) ||
    isPackageManagerScriptName(parsed, FORMAT_SCRIPTS) ||
    isFormatCommand(parsed)
  ) {
    return {category: "format", risk: "medium"};
  }

  if (isDependencyMutation(parsed)) {
    return {category: "dependency_mutation", risk: "high"};
  }

  if (executable === "git") {
    return classifyGit(parsed);
  }

  if (NETWORK_COMMANDS.has(executable)) {
    return {category: "network", risk: "high"};
  }

  return {category: "unknown", risk: "medium"};
}

/** Matches package-manager scripts while honoring WorkspaceProfile when present. */
export function isPackageScript(
  parsed: ParsedCommand,
  profile: WorkspaceProfile | undefined,
  scriptNames: ReadonlySet<string>,
): boolean {
  if (!parsed.executable || !PACKAGE_MANAGERS.has(parsed.executable)) {
    return false;
  }

  const script = packageScriptName(parsed);
  if (!script || !scriptNames.has(script)) {
    return false;
  }

  if (!profile) {
    return true;
  }

  if (!profile.scripts[script]) {
    return false;
  }

  const packageManager = profile.packageManager ?? "npm";
  return parsed.executable === packageManager;
}

/** Returns the script name from npm/pnpm/yarn command shapes. */
export function packageScriptName(parsed: ParsedCommand): string | undefined {
  const [first, second] = parsed.args;
  if (!first) {
    return undefined;
  }

  if (parsed.executable === "npm") {
    return first === "run" ? second : undefined;
  }

  return first === "run" ? second : first;
}

/** Classifies each segment of a composed shell command for audit metadata. */
export function segmentCategories(
  segments: readonly string[],
  profile?: WorkspaceProfile,
): CommandCategory[] {
  return segments.map((segment) => classifyCommandFromSegment(segment, profile).category);
}

export function classifyCommandFromSegment(
  segment: string,
  profile?: WorkspaceProfile,
): CommandClassification {
  const [executable, ...args] = tokenize(segment);
  return classifyCommand(
    {
      raw: segment,
      normalized: segment.trim(),
      executable: executable ? executable.toLowerCase() : undefined,
      args,
      hasControlOperator: false,
      hasPipe: false,
      hasRedirection: false,
      hasCommandSubstitution: false,
      segments: [segment],
    },
    profile,
  );
}

function isDependencyMutation(parsed: ParsedCommand): boolean {
  if (!parsed.executable || !PACKAGE_MANAGERS.has(parsed.executable)) {
    return false;
  }

  const command = parsed.args[0];
  if (!command) {
    return false;
  }

  return DEPENDENCY_MUTATIONS.has(command);
}

function isPackageManagerScriptName(
  parsed: ParsedCommand,
  scriptNames: ReadonlySet<string>,
): boolean {
  if (!parsed.executable || !PACKAGE_MANAGERS.has(parsed.executable)) {
    return false;
  }

  const script = packageScriptName(parsed);
  return script ? scriptNames.has(script) : false;
}

function classifyGit(parsed: ParsedCommand): CommandClassification {
  const subcommand = parsed.args.find((arg) => !arg.startsWith("-"));
  if (!subcommand) {
    return {category: "unknown", risk: "medium"};
  }

  if (GIT_READ_COMMANDS.has(subcommand) && !hasWriteFlag(parsed.args)) {
    return {category: "git_read", risk: "low"};
  }

  if (GIT_WRITE_COMMANDS.has(subcommand)) {
    return {category: "git_write", risk: gitRisk(parsed.args)};
  }

  return {category: "unknown", risk: "medium"};
}

function hasWriteFlag(args: readonly string[]): boolean {
  return args.some((arg) =>
    [
      "-d",
      "-D",
      "-m",
      "-M",
      "--delete",
      "--force",
      "--move",
      "--set-upstream-to",
      "--unset-upstream",
    ].includes(arg),
  );
}

function gitRisk(args: readonly string[]): PolicyRisk {
  if (args.includes("--hard") || args.some((arg) => /^-.*f/.test(arg))) {
    return "critical";
  }

  return "high";
}

function isFormatCommand(parsed: ParsedCommand): boolean {
  if (parsed.executable === "prettier") {
    return parsed.args.includes("--write");
  }

  if (parsed.executable === "eslint") {
    return parsed.args.includes("--fix");
  }

  return false;
}
