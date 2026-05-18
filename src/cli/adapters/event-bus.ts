import type {CliEvent, UserInputEvent} from "../types/events.js";

type Listener<TEvent> = (event: TEvent) => void;

export class EventBus<TEvent> {
  private readonly listeners = new Set<Listener<TEvent>>();

  emit(event: TEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  subscribe(listener: Listener<TEvent>): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export type CliEventBus = EventBus<CliEvent>;
export type UserInputBus = EventBus<UserInputEvent>;

export function createCliEventBus(): CliEventBus {
  return new EventBus<CliEvent>();
}

export function createUserInputBus(): UserInputBus {
  return new EventBus<UserInputEvent>();
}
