import type {ToolResult} from "./types.js";

export type ToolRunnerOptions = {
  defaultTimeoutMs?: number;
  onEvent?: (event: ToolRunnerEvent) => void | Promise<void>;
  now?: () => number;
  createCallId?: () => string;
};

export type ToolRunOptions = {
  timeoutMs?: number | false;
  signal?: AbortSignal;
  callId?: string;
  metadata?: Record<string, unknown>;
};

type ToolRunnerEventBase = {
  callId: string;
  toolName: string;
  startedAt: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
};

type ToolRunnerTerminalEventBase = ToolRunnerEventBase & {
  endedAt: number;
  durationMs: number;
  result: ToolResult;
  errorCode?: string;
};

export type ToolRunnerEvent =
  | (ToolRunnerEventBase & {
      type: "runner.tool.started";
    })
  | (ToolRunnerTerminalEventBase & {
      type: "runner.tool.completed";
    })
  | (ToolRunnerTerminalEventBase & {
      type: "runner.tool.failed";
    })
  | (ToolRunnerTerminalEventBase & {
      type: "runner.tool.timed_out";
      errorCode: "TOOL_TIMEOUT";
    })
  | (ToolRunnerTerminalEventBase & {
      type: "runner.tool.aborted";
      errorCode: "TOOL_ABORTED";
    });
