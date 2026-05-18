import type {CliEvent, UserInputEvent} from "./types.js";

type TypedEvent = {type: string};
type Listener<TEvent extends TypedEvent> = (event: TEvent) => void;
type EventType<TEvent extends TypedEvent> = TEvent["type"] | "*";

export type ReplayOptions = {
  limit?: number;
  type?: string;
};

export class EventBus<TEvent extends TypedEvent> {
  private readonly listeners = new Map<string, Set<Listener<TEvent>>>();
  private readonly events: TEvent[] = [];

  constructor(private readonly maxHistory = 200) {}

  on(type: EventType<TEvent>, listener: Listener<TEvent>): () => void {
    const key = String(type);
    const listeners = this.listeners.get(key) ?? new Set<Listener<TEvent>>();
    listeners.add(listener);
    this.listeners.set(key, listeners);

    return () => {
      this.off(type, listener);
    };
  }

  off(type: EventType<TEvent>, listener: Listener<TEvent>): void {
    this.listeners.get(String(type))?.delete(listener);
  }

  once(type: EventType<TEvent>, listener: Listener<TEvent>): () => void {
    const unsubscribe = this.on(type, (event) => {
      unsubscribe();
      listener(event);
    });

    return unsubscribe;
  }

  emit(event: TEvent): void {
    this.events.push(event);
    if (this.events.length > this.maxHistory) {
      this.events.splice(0, this.events.length - this.maxHistory);
    }

    for (const listener of this.listeners.get(event.type) ?? []) {
      listener(event);
    }
    for (const listener of this.listeners.get("*") ?? []) {
      listener(event);
    }
  }

  clear(): void {
    this.events.length = 0;
  }

  history(): TEvent[] {
    return [...this.events];
  }

  replay(listener: Listener<TEvent>, options: ReplayOptions = {}): void {
    const events = options.type
      ? this.events.filter((event) => event.type === options.type)
      : this.events;
    const selected =
      options.limit && options.limit > 0 ? events.slice(-options.limit) : events;

    for (const event of selected) {
      listener(event);
    }
  }

  subscribe(listener: Listener<TEvent>): () => void {
    return this.on("*", listener);
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

