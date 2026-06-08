import {spawn} from "node:child_process";

const RG_TIMEOUT_MS = 10_000;
const RG_MAX_OUTPUT_LENGTH = 1_000_000;

export const DEFAULT_IGNORED_DIRECTORY_GLOBS = [
  "!node_modules/**",
  "!.git/**",
  "!dist/**",
  "!build/**",
  "!coverage/**",
] as const;

type RgRunOptions = {
  cwd: string;
  maxOutputLength?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
};

export type RgRunResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

let rgAvailability: boolean | undefined;

export async function isRgAvailable(cwd: string): Promise<boolean> {
  // Cache the probe so each tool call does not spawn `rg --version`.
  if (rgAvailability !== undefined) {
    return rgAvailability;
  }

  try {
    const result = await runRg(["--version"], {
      cwd,
      maxOutputLength: 2000,
      timeoutMs: 3000,
    });
    rgAvailability = result.exitCode === 0;
  } catch {
    rgAvailability = false;
  }

  return rgAvailability;
}

export async function runRg(
  args: readonly string[],
  options: RgRunOptions,
): Promise<RgRunResult> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const maxOutputLength = options.maxOutputLength ?? RG_MAX_OUTPUT_LENGTH;
    // Pass args directly to avoid shell interpolation of model-provided input.
    const child = spawn("rg", args, {
      cwd: options.cwd,
      shell: false,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, options.timeoutMs ?? RG_TIMEOUT_MS);

    const abort = (): void => {
      timedOut = true;
      child.kill();
    };

    options.signal?.addEventListener("abort", abort, {once: true});

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      stdout = appendLimited(stdout, chunk, maxOutputLength);
    });

    child.stderr?.on("data", (chunk: string) => {
      stderr = appendLimited(stderr, chunk, maxOutputLength);
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", abort);

      resolve({
        exitCode,
        stdout,
        stderr,
        timedOut,
      });
    });
  });
}

export function createIgnoredDirectoryArgs(): string[] {
  // Keep rg behavior aligned with the Node fallback's generated-directory skip list.
  return DEFAULT_IGNORED_DIRECTORY_GLOBS.flatMap((glob) => ["--glob", glob]);
}

export function parseRgFileLines(stdout: string): string[] {
  return stdout
    .split(/\r?\n/)
    .filter((line) => line.length > 0)
    .map((line) => line.replaceAll("\\", "/"));
}

function appendLimited(current: string, chunk: string, maxLength: number): string {
  if (current.length >= maxLength) {
    return current;
  }

  return `${current}${chunk}`.slice(0, maxLength);
}
