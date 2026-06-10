import {spawn} from "node:child_process";

import {CommandPolicy} from "./command-policy.js";
import type {VerificationResult, WorkspaceProfile} from "./types.js";

const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_OUTPUT_LENGTH = 24_000;

export type VerificationOptions = {
  commands?: readonly string[];
  signal?: AbortSignal;
};

export class Verifier {
  constructor(private readonly commandPolicy = new CommandPolicy()) {}

  selectCommands(profile: WorkspaceProfile, requested?: readonly string[]): string[] {
    if (requested?.length) {
      return [...requested];
    }

    const packageManager = profile.packageManager ?? "npm";
    for (const script of ["typecheck", "build", "test"]) {
      if (profile.scripts[script]) {
        return [formatScriptCommand(packageManager, script)];
      }
    }

    return [];
  }

  async verify(
    workspaceRoot: string,
    profile: WorkspaceProfile,
    options: VerificationOptions = {},
  ): Promise<VerificationResult[]> {
    const commands = this.selectCommands(profile, options.commands);
    const results: VerificationResult[] = [];

    for (const command of commands) {
      const decision = this.commandPolicy.canRun(command, profile);
      if (!decision.allowed) {
        results.push({
          command,
          exitCode: null,
          stdout: "",
          stderr: decision.reason ?? "Command was rejected by policy.",
          passed: false,
          timedOut: false,
        });
        continue;
      }

      results.push(await runCommand(command, workspaceRoot, options.signal));
    }

    return results;
  }
}

function formatScriptCommand(
  packageManager: NonNullable<WorkspaceProfile["packageManager"]>,
  script: string,
): string {
  if (packageManager === "npm") {
    return `npm run ${script}`;
  }

  return `${packageManager} ${script}`;
}

async function runCommand(
  command: string,
  cwd: string,
  signal?: AbortSignal,
): Promise<VerificationResult> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const child = spawn(command, {
      cwd,
      shell: true,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, DEFAULT_TIMEOUT_MS);

    const abort = (): void => {
      timedOut = true;
      child.kill();
    };

    signal?.addEventListener("abort", abort, {once: true});
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk: string) => {
      stdout = appendLimited(stdout, chunk, DEFAULT_MAX_OUTPUT_LENGTH);
    });
    child.stderr?.on("data", (chunk: string) => {
      stderr = appendLimited(stderr, chunk, DEFAULT_MAX_OUTPUT_LENGTH);
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
      resolve({
        command,
        exitCode,
        stdout,
        stderr,
        passed: exitCode === 0 && !timedOut,
        timedOut,
      });
    });
  });
}

function appendLimited(current: string, chunk: string, maxLength: number): string {
  if (current.length >= maxLength) {
    return current;
  }

  return `${current}${chunk}`.slice(0, maxLength);
}
