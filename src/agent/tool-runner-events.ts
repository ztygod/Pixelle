import type {EventBus, PixelleEvent} from "../events/index.js";
import type {ToolResult, ToolRunnerEvent} from "../tool/index.js";
import {inferToolTarget} from "../tool/tool-target.js";
import {emitAgentEvent} from "./runtime-utils.js";
import type {RunInternalOptions} from "./types.js";

type RunnerLiveEvent = Extract<
  ToolRunnerEvent,
  {type: "runner.tool.started"} | {type: "runner.tool.streamed"}
>;

type RunnerTerminalEvent = Exclude<ToolRunnerEvent, RunnerLiveEvent>;

/** Bridges live ToolRunner lifecycle events into public Agent events.
 *
 * Runner events describe raw execution mechanics. Agent events are the public
 * semantic stream consumed by CLI, trace, replay, and external observers. Only
 * started/streamed events are bridged immediately; terminal events are emitted
 * separately after Agent middleware has finalized the ToolResult.
 */
export function emitRunnerLiveEventAsAgentEvent(input: {
  eventBus: EventBus<PixelleEvent>;
  event: RunnerLiveEvent;
  options: RunInternalOptions;
}): void {
  const metadata = input.event.metadata;

  switch (input.event.type) {
    case "runner.tool.started":
      emitAgentEvent(
        input.eventBus,
        {
          type: "tool.call_started",
          id: input.event.callId,
          name: input.event.toolName,
          target: inferToolTarget(input.event.toolName, input.event.input),
          input: input.event.input,
          status: "running",
          metadata,
        },
        input.options,
      );
      return;

    case "runner.tool.streamed":
      emitAgentEvent(
        input.eventBus,
        {
          type: "tool.call_stream",
          id: input.event.callId,
          name: input.event.toolName,
          stream: input.event.stream,
          metadata,
        },
        input.options,
      );
      return;
  }
}

/** Emits the final public Agent tool event from the post-middleware ToolResult.
 *
 * The terminal runner event contributes timing and metadata only. Its raw
 * result is intentionally ignored so afterTool middleware remains the last word
 * on what CLI, Trace, Replay, and external consumers observe.
 */
export function emitFinalToolResultAsAgentEvent(input: {
  eventBus: EventBus<PixelleEvent>;
  runnerEvent: RunnerTerminalEvent;
  result: ToolResult;
  options: RunInternalOptions;
}): void {
  const metadata = input.runnerEvent.metadata;

  if (input.result.ok) {
    emitAgentEvent(
      input.eventBus,
      {
        type: "tool.call_completed",
        id: input.runnerEvent.callId,
        name: input.runnerEvent.toolName,
        result: input.result,
        durationMs: input.runnerEvent.durationMs,
        target: inferToolTarget(
          input.runnerEvent.toolName,
          input.result.display,
          input.result.data,
        ),
        output: input.result.data,
        summary: input.result.message,
        display: input.result.display,
        metadata,
      },
      input.options,
    );
    return;
  }

  emitAgentEvent(
    input.eventBus,
    {
      type: "tool.call_failed",
      id: input.runnerEvent.callId,
      name: input.runnerEvent.toolName,
      result: input.result,
      durationMs: input.runnerEvent.durationMs,
      target: inferToolTarget(
        input.runnerEvent.toolName,
        input.result.display,
        input.result.data,
      ),
      error: input.result.message,
      code: input.result.code,
      data: input.result.data,
      display: input.result.display,
      metadata,
    },
    input.options,
  );
}
