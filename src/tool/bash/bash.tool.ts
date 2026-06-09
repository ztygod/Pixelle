import {spawn} from "node:child_process";
import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_OUTPUT_LENGTH = 20_000;

const bashParameters = z.object({
  reason: z
    .string()
    .describe(
      "Explain why you are calling this tool and what you expect to learn or change.",
    ),
  command: z
    .string()
    .min(1)
    .describe(
      "Shell command to execute from workspaceRoot. Prefer read_file, write_file, glob, or grep for precise file operations.",
    ),
  timeoutMs: z
    .number()
    .positive()
    .optional()
    .describe("Maximum command runtime in milliseconds. Defaults to 30000."),
  maxOutputLength: z
    .number()
    .positive()
    .optional()
    .describe(
      "Maximum characters to keep from stdout and stderr separately. Defaults to 20000.",
    ),
});

type BashResult = {
  command: string;
  cwd: string;
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

export const bashTool: Tool<typeof bashParameters, BashResult> = {
  definition: {
    name: "bash",
    description:
      "Execute a shell command from workspaceRoot when a project command, build, test, typecheck, or command-line inspection is the right tool. Do not use this for simple file reads, writes, path discovery, or content search when read_file, write_file, glob, or grep are more precise. Commands run with workspaceRoot as cwd, can have side effects, and require explicit shell permission. Returns stdout, stderr, exit code, cwd, command, and timeout status.",
    parameters: bashParameters,
  },
  async execute(input, context) {
    requireShellPermission(context, "bash");

    const timeoutMs = Math.floor(input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
    const maxOutputLength = Math.floor(
      input.maxOutputLength ?? DEFAULT_MAX_OUTPUT_LENGTH,
    );
    const result = await runShellCommand({
      command: input.command,
      cwd: context.workspaceRoot,
      maxOutputLength,
      signal: context.signal,
      timeoutMs,
    });

    return okToolResult("Executed shell command.", result);
  },
};

function requireShellPermission(context: ToolContext, toolName: string): void {
  if (!context.permissions?.shell) {
    throw new ToolError({
      code: "TOOL_PERMISSION_DENIED",
      message: "Shell permission is required.",
      toolName,
    });
  }
}

type RunShellCommandInput = {
  command: string;
  cwd: string;
  maxOutputLength: number;
  signal?: AbortSignal;
  timeoutMs: number;
};

async function runShellCommand(
  input: RunShellCommandInput,
): Promise<BashResult> {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    // Run through the platform shell so users can execute normal project commands.
    const child = spawn(input.command, {
      cwd: input.cwd,
      shell: true,
      windowsHide: true,
    });

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill();
    }, input.timeoutMs);

    const abort = (): void => {
      timedOut = true;
      child.kill();
    };

    input.signal?.addEventListener("abort", abort, {once: true});

    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");

    child.stdout?.on("data", (chunk: string) => {
      // Bound output so a noisy command cannot flood the model context.
      stdout = appendLimited(stdout, chunk, input.maxOutputLength);
    });

    child.stderr?.on("data", (chunk: string) => {
      stderr = appendLimited(stderr, chunk, input.maxOutputLength);
    });

    child.on("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);
      reject(error);
    });

    child.on("close", (exitCode) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      input.signal?.removeEventListener("abort", abort);

      resolve({
        command: input.command,
        cwd: input.cwd,
        exitCode,
        stdout,
        stderr,
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
