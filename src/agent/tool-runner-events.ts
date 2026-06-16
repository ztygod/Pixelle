import type {EventBus, PixelleEvent} from "../events/index.js";
import type {ToolRunnerEvent} from "../tool/index.js";
import {emitAgentEvent} from "./runtime-utils.js";
import type {RunInternalOptions} from "./types.js";

export function emitToolRunnerEventAsAgentEvent(input: {
  eventBus: EventBus<PixelleEvent>;
  event: ToolRunnerEvent;
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
          input: input.event.input,
          status: "running",
          metadata,
        },
        input.options,
      );
      return;

    case "runner.tool.completed":
      emitAgentEvent(
        input.eventBus,
        {
          type: "tool.call_completed",
          id: input.event.callId,
          name: input.event.toolName,
          output: input.event.result.data,
          summary: input.event.result.message,
          metadata,
        },
        input.options,
      );
      return;

    case "runner.tool.failed":
    case "runner.tool.timed_out":
    case "runner.tool.aborted":
      emitAgentEvent(
        input.eventBus,
        {
          type: "tool.call_failed",
          id: input.event.callId,
          name: input.event.toolName,
          error: input.event.result.message,
          code: input.event.errorCode,
          data: input.event.result.data,
          metadata,
        },
        input.options,
      );
      return;
  }
}
