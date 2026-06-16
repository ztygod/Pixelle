import type {ToolResult} from "./types.js";

/** Constructor-level options that configure ToolRunner behavior for all calls. */
export type ToolRunnerOptions = {
  /** Default timeout applied when a specific run does not override it. */
  defaultTimeoutMs?: number;
  /** Observability hook for runner lifecycle events; failures are ignored by ToolRunner. */
  onEvent?: (event: ToolRunnerEvent) => void | Promise<void>;
  /** Clock used for event timestamps and durations, primarily injectable for tests. */
  now?: () => number;
  /** Call ID factory used when a run does not provide an explicit callId. */
  createCallId?: () => string;
};

/** Per-call options supplied when executing a single tool. */
export type ToolRunOptions = {
  /** Timeout for this run, or false to disable timeout handling. */
  timeoutMs?: number | false;
  /** Optional cancellation signal for this run in addition to ToolContext.signal. */
  signal?: AbortSignal;
  /** Stable ID used to correlate runner events with agent or provider tool calls. */
  callId?: string;
  /** Opaque metadata copied to runner events for tracing and adapters. */
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
};

export type ToolRunnerEvent =
  /** Emitted before registry lookup, validation, or tool execution starts. */
  | (ToolRunnerEventBase & {
      type: "runner.tool.started";
      input?: unknown;
    })
  /** Emitted after a tool returns a successful ToolResult. */
  | (ToolRunnerTerminalEventBase & {
      type: "runner.tool.completed";
    })
  /** Emitted after validation or execution returns a non-control failure. */
  | (ToolRunnerTerminalEventBase & {
      type: "runner.tool.failed";
      errorCode: string;
    })
  /** Emitted when ToolRunner's timeout control wins the execution race. */
  | (ToolRunnerTerminalEventBase & {
      type: "runner.tool.timed_out";
      errorCode: "TOOL_TIMEOUT";
    })
  /** Emitted when an external or context abort signal cancels execution. */
  | (ToolRunnerTerminalEventBase & {
      type: "runner.tool.aborted";
      errorCode: "TOOL_ABORTED";
    });
