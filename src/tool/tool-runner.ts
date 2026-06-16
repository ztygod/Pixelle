import {ToolError} from "./tool-error.js";
import {errorToolResult} from "./tool-result.js";
import type {ToolContext, ToolResult} from "./types.js";
import type {ToolRegistry} from "./tool-registry.js";
import type {
  ToolRunOptions,
  ToolRunnerEvent,
  ToolRunnerOptions,
} from "./tool-runner-types.js";

const DEFAULT_TOOL_TIMEOUT_MS = 30_000;
const controlOutcomeTag = Symbol("ToolRunnerControlOutcome");

let fallbackCallCounter = 0;

type ControlOutcome = {
  readonly [controlOutcomeTag]: true;
  type: "timeout" | "abort";
};

type ExecutionControl = {
  signal: AbortSignal;
  promise: Promise<ControlOutcome>;
  cleanup: () => void;
};

/**
 * Executes registered tools behind a stable boundary for validation, cancellation,
 * timeout handling, result normalization, and runner-level lifecycle events.
 */
export class ToolRunner {
  private readonly defaultTimeoutMs: number;
  private readonly onEvent?: (event: ToolRunnerEvent) => void | Promise<void>;
  private readonly now: () => number;
  private readonly createCallId: () => string;

  constructor(
    private readonly registry: ToolRegistry,
    options: ToolRunnerOptions = {},
  ) {
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TOOL_TIMEOUT_MS;
    this.onEvent = options.onEvent;
    this.now = options.now ?? Date.now;
    this.createCallId =
      options.createCallId ?? (() => `tool-call-${++fallbackCallCounter}`);
  }

  /**
   * Runs one tool by name and always resolves to a normalized ToolResult.
   *
   * ToolRunner owns registry lookup, schema validation, context signal replacement,
   * timeout/abort racing, and conversion of thrown errors into tool error results.
   */
  async run(
    name: string,
    input: unknown,
    context: ToolContext,
    options: ToolRunOptions = {},
  ): Promise<ToolResult> {
    const callId = options.callId ?? this.createCallId();
    const timeoutMs = resolveTimeoutMs(options.timeoutMs, this.defaultTimeoutMs);
    const startedAt = this.now();

    await this.emitEvent({
      type: "runner.tool.started",
      callId,
      toolName: name,
      input,
      startedAt,
      timeoutMs,
      metadata: options.metadata,
    });

    const tool = this.registry.get(name);

    if (!tool) {
      return await this.finalize({
        callId,
        toolName: name,
        startedAt,
        timeoutMs,
        metadata: options.metadata,
        result: errorToolResult(`Tool "${name}" is not registered.`, "TOOL_NOT_FOUND"),
      });
    }

    const parsedInput = tool.definition.parameters.safeParse(input);

    if (!parsedInput.success) {
      // Validation errors are returned to the agent loop as structured tool results.
      return await this.finalize({
        callId,
        toolName: name,
        startedAt,
        timeoutMs,
        metadata: options.metadata,
        result: errorToolResult(
          `Invalid input for tool "${name}".`,
          "TOOL_INVALID_INPUT",
          {
            issues: parsedInput.error.issues,
          },
        ),
      });
    }

    const control = createExecutionControl({
      contextSignal: context.signal,
      runSignal: options.signal,
      timeoutMs,
    });

    try {
      if (control.signal.aborted) {
        return await this.finalize({
          callId,
          toolName: name,
          startedAt,
          timeoutMs,
          metadata: options.metadata,
          result: errorToolResult(`Tool "${name}" was aborted.`, "TOOL_ABORTED"),
        });
      }

      const executionContext: ToolContext = {
        ...context,
        signal: control.signal,
      };
      const outcome = await Promise.race([
        Promise.resolve(tool.execute(parsedInput.data, executionContext)),
        control.promise,
      ]);

      if (isControlOutcome(outcome)) {
        return await this.finalize({
          callId,
          toolName: name,
          startedAt,
          timeoutMs,
          metadata: options.metadata,
          result:
            outcome.type === "timeout"
              ? errorToolResult(`Tool "${name}" timed out.`, "TOOL_TIMEOUT", {
                  timeoutMs,
                })
              : errorToolResult(`Tool "${name}" was aborted.`, "TOOL_ABORTED"),
        });
      }

      return await this.finalize({
        callId,
        toolName: name,
        startedAt,
        timeoutMs,
        metadata: options.metadata,
        result: outcome,
      });
    } catch (error) {
      if (error instanceof ToolError) {
        return await this.finalize({
          callId,
          toolName: name,
          startedAt,
          timeoutMs,
          metadata: options.metadata,
          result: errorToolResult(error.message, error.code, error.details),
        });
      }

      const result =
        control.signal.aborted && isAbortLikeError(error)
          ? errorToolResult(`Tool "${name}" was aborted.`, "TOOL_ABORTED")
          : errorToolResult(
              error instanceof Error ? error.message : `Tool "${name}" failed.`,
              "TOOL_EXECUTION_FAILED",
            );

      return await this.finalize({
        callId,
        toolName: name,
        startedAt,
        timeoutMs,
        metadata: options.metadata,
        result,
      });
    } finally {
      control.cleanup();
    }
  }

  /** Records timing data, emits the terminal runner event, and returns the result. */
  private async finalize(input: {
    callId: string;
    toolName: string;
    startedAt: number;
    timeoutMs?: number;
    metadata?: Record<string, unknown>;
    result: ToolResult;
  }): Promise<ToolResult> {
    const endedAt = this.now();
    const durationMs = Math.max(0, endedAt - input.startedAt);

    const terminalEventBase = {
      callId: input.callId,
      toolName: input.toolName,
      startedAt: input.startedAt,
      endedAt,
      durationMs,
      result: input.result,
      timeoutMs: input.timeoutMs,
      metadata: input.metadata,
    };

    await this.emitEvent(toTerminalEvent(terminalEventBase));

    return input.result;
  }

  /** Emits a runner event without allowing observer failures to affect execution. */
  private async emitEvent(event: ToolRunnerEvent): Promise<void> {
    try {
      await this.onEvent?.(event);
    } catch {
      // Observability hooks must not change tool execution semantics.
    }
  }
}

/** Resolves per-call timeout policy, including explicit timeout disabling. */
function resolveTimeoutMs(
  runTimeoutMs: ToolRunOptions["timeoutMs"],
  defaultTimeoutMs: number,
): number | undefined {
  if (runTimeoutMs === false) {
    return undefined;
  }

  return Math.max(0, Math.floor(runTimeoutMs ?? defaultTimeoutMs));
}

/** Creates the combined abort/timeout signal used for one tool execution. */
function createExecutionControl(input: {
  contextSignal?: AbortSignal;
  runSignal?: AbortSignal;
  timeoutMs?: number;
}): ExecutionControl {
  const controller = new AbortController();
  const listeners: Array<() => void> = [];
  let timeout: ReturnType<typeof setTimeout> | undefined;
  let settle: (outcome: ControlOutcome) => void = () => {};

  const promise = new Promise<ControlOutcome>((resolve) => {
    settle = resolve;
  });

  const abort = (type: ControlOutcome["type"]): void => {
    if (!controller.signal.aborted) {
      controller.abort();
    }

    settle({[controlOutcomeTag]: true, type});
  };

  const listenForAbort = (signal: AbortSignal | undefined): void => {
    if (!signal) {
      return;
    }

    if (signal.aborted) {
      abort("abort");
      return;
    }

    const listener = (): void => abort("abort");
    signal.addEventListener("abort", listener, {once: true});
    listeners.push(() => signal.removeEventListener("abort", listener));
  };

  listenForAbort(input.contextSignal);
  listenForAbort(input.runSignal);

  if (input.timeoutMs !== undefined) {
    timeout = setTimeout(() => abort("timeout"), input.timeoutMs);
  }

  return {
    signal: controller.signal,
    promise,
    cleanup: () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      for (const removeListener of listeners) {
        removeListener();
      }
    },
  };
}

/** Detects the internal race outcome object produced by execution control. */
function isControlOutcome(value: unknown): value is ControlOutcome {
  return (
    typeof value === "object" &&
    value !== null &&
    controlOutcomeTag in value &&
    "type" in value &&
    (value.type === "timeout" || value.type === "abort")
  );
}

/** Detects standard abort-style errors from APIs that reject on cancellation. */
function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

/** Converts a normalized ToolResult into the matching terminal runner event. */
function toTerminalEvent(
  event: Omit<
    Extract<
      ToolRunnerEvent,
      {type: Exclude<ToolRunnerEvent["type"], "runner.tool.started">}
    >,
    "type" | "errorCode"
  >,
): Exclude<ToolRunnerEvent, {type: "runner.tool.started"}> {
  if (event.result.ok) {
    return {
      ...event,
      type: "runner.tool.completed",
    };
  }

  if (event.result.code === "TOOL_TIMEOUT") {
    return {
      ...event,
      type: "runner.tool.timed_out",
      errorCode: "TOOL_TIMEOUT",
    };
  }

  if (event.result.code === "TOOL_ABORTED") {
    return {
      ...event,
      type: "runner.tool.aborted",
      errorCode: "TOOL_ABORTED",
    };
  }

  return {
    ...event,
    type: "runner.tool.failed",
    errorCode: event.result.code,
  };
}
