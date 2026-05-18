import type {CliEvent} from "../types/events.js";

export type RuntimeEventSource = {
  subscribe(callback: (event: CliEvent) => void): () => void;
};

export function connectRuntimeEvents(
  source: RuntimeEventSource,
  pushEvent: (event: CliEvent) => void,
): () => void {
  return source.subscribe(pushEvent);
}
