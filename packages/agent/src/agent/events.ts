import type {PixelleEvent} from "../eventsbus/index.js";
import type {EventBus} from "../eventsbus/index.js";
import type {AgentRunInput, RunInternalOptions} from "./types.js";

/** Creates trace metadata shared by all events emitted during a run. */
export function createEventMetadata(
  input: AgentRunInput,
  sessionId: string,
  traceId: string,
): Record<string, unknown> {
  return {
    ...input.metadata,
    sessionId,
    traceId,
    source: "agent",
  };
}

/** Emits to the shared event bus and optionally mirrors the event to stream(). */
export function emitAgentEvent(
  eventBus: EventBus<PixelleEvent>,
  event: PixelleEvent,
  options: RunInternalOptions,
): void {
  const publishedEvent = eventBus.emit(event);
  options.eventSink?.(publishedEvent ?? event);
}
