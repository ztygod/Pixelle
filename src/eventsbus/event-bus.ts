import type {
  BaseEvent,
  EventListener,
  EventMiddleware,
  EventType,
  PublishedEvent,
  ReplayOptions,
} from "./types.js";

export type EventBusOptions<TEvent extends BaseEvent> = {
  /** Maximum number of published events kept in memory for history/replay. */
  maxHistorySize?: number;
  /** Middleware registered before any runtime calls to `use()`. */
  middleware?: readonly EventMiddleware<TEvent>[];
  /** Injectable clock for tests and deterministic demos. */
  now?: () => number;
};

/**
 * Small synchronous event bus for application infrastructure.
 *
 * Example:
 *
 * ```ts
 * type AppEvent =
 *   | (BaseEvent<"task_started"> & {id: string})
 *   | (BaseEvent<"task_finished"> & {id: string; summary?: string});
 *
 * const bus = new EventBus<AppEvent>({
 *   middleware: [
 *     (event) => ({
 *       ...event,
 *       metadata: {...event.metadata, source: "runtime"},
 *     }),
 *   ],
 * });
 *
 * bus.on("task_started", (event) => {
 *   console.log(event.id, event.createdAt);
 * });
 *
 * bus.emit({type: "task_started", id: "task_1"});
 * bus.replay(console.log, {type: "task_started", limit: 10});
 * ```
 */
export class EventBus<TEvent extends BaseEvent> {
  private readonly listenersByType = new Map<
    string,
    Set<EventListener<TEvent>>
  >();
  private readonly historyBuffer: PublishedEvent<TEvent>[] = [];
  private readonly middleware: EventMiddleware<TEvent>[];
  private readonly maxHistorySize: number;
  private readonly now: () => number;

  constructor(options: EventBusOptions<TEvent> = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 200;
    this.middleware = [...(options.middleware ?? [])];
    this.now = options.now ?? Date.now;
  }

  /**
   * Registers a listener for one event type, or for "*" to observe all events.
   */
  on(
    type: EventType<TEvent>,
    listener: EventListener<TEvent>,
  ): () => void {
    const eventType = String(type);
    const listeners =
      this.listenersByType.get(eventType) ?? new Set<EventListener<TEvent>>();
    listeners.add(listener);
    this.listenersByType.set(eventType, listeners);

    return () => {
      this.off(type, listener);
    };
  }

  /**
   * Removes a previously registered listener.
   */
  off(type: EventType<TEvent>, listener: EventListener<TEvent>): void {
    this.listenersByType.get(String(type))?.delete(listener);
  }

  /**
   * Registers a listener that is removed after the first matching event.
   */
  once(
    type: EventType<TEvent>,
    listener: EventListener<TEvent>,
  ): () => void {
    const unsubscribe = this.on(type, (event) => {
      unsubscribe();
      listener(event);
    });

    return unsubscribe;
  }

  /**
   * Publishes an event synchronously.
   *
   * `createdAt` is filled before middleware runs. If any middleware returns
   * `undefined`, the event is dropped and listeners are not called.
   */
  emit(event: TEvent): PublishedEvent<TEvent> | undefined {
    let publishedEvent: PublishedEvent<TEvent> = {
      ...event,
      createdAt: event.createdAt ?? this.now(),
      metadata: event.metadata ? {...event.metadata} : undefined,
    };

    for (const transformEvent of this.middleware) {
      const transformedEvent = transformEvent(publishedEvent);
      if (!transformedEvent) {
        return undefined;
      }
      publishedEvent = transformedEvent;
    }

    this.historyBuffer.push(publishedEvent);
    if (this.historyBuffer.length > this.maxHistorySize) {
      this.historyBuffer.splice(
        0,
        this.historyBuffer.length - this.maxHistorySize,
      );
    }

    for (const listener of this.listenersByType.get(publishedEvent.type) ?? []) {
      listener(publishedEvent);
    }
    for (const listener of this.listenersByType.get("*") ?? []) {
      listener(publishedEvent);
    }

    return publishedEvent;
  }

  /**
   * Adds middleware after construction and returns an unsubscribe function.
   */
  use(middleware: EventMiddleware<TEvent>): () => void {
    this.middleware.push(middleware);

    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index >= 0) {
        this.middleware.splice(index, 1);
      }
    };
  }

  /**
   * Clears in-memory history without touching listeners or middleware.
   */
  clear(): void {
    this.historyBuffer.length = 0;
  }

  /**
   * Returns a shallow copy of retained published events.
   */
  history(): PublishedEvent<TEvent>[] {
    return [...this.historyBuffer];
  }

  /**
   * Replays retained history into a listener without re-emitting events.
   */
  replay(
    listener: EventListener<TEvent>,
    options: ReplayOptions<TEvent> = {},
  ): void {
    const replayableEvents = options.type
      ? this.historyBuffer.filter((event) => event.type === options.type)
      : this.historyBuffer;
    const eventsToReplay =
      options.limit && options.limit > 0
        ? replayableEvents.slice(-options.limit)
        : replayableEvents;

    for (const event of eventsToReplay) {
      listener(event);
    }
  }

  /**
   * Convenience wildcard subscription for all published events.
   */
  subscribe(listener: EventListener<TEvent>): () => void {
    return this.on("*", listener);
  }
}
