import type {
  BaseEvent,
  EventListener,
  EventMiddleware,
  EventType,
  PublishedEvent,
  ReplayOptions,
} from "./types.js";

export type EventBusOptions<TEvent extends BaseEvent> = {
  maxHistorySize?: number;
  middleware?: readonly EventMiddleware<TEvent>[];
  now?: () => number;
};

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

  on(type: EventType<TEvent>, listener: EventListener<TEvent>): () => void {
    const eventType = String(type);
    const listeners =
      this.listenersByType.get(eventType) ?? new Set<EventListener<TEvent>>();
    listeners.add(listener);
    this.listenersByType.set(eventType, listeners);

    return () => {
      this.off(type, listener);
    };
  }

  off(type: EventType<TEvent>, listener: EventListener<TEvent>): void {
    this.listenersByType.get(String(type))?.delete(listener);
  }

  once(type: EventType<TEvent>, listener: EventListener<TEvent>): () => void {
    const unsubscribe = this.on(type, (event) => {
      unsubscribe();
      listener(event);
    });

    return unsubscribe;
  }

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

  use(middleware: EventMiddleware<TEvent>): () => void {
    this.middleware.push(middleware);

    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index >= 0) {
        this.middleware.splice(index, 1);
      }
    };
  }

  clear(): void {
    this.historyBuffer.length = 0;
  }

  history(): PublishedEvent<TEvent>[] {
    return [...this.historyBuffer];
  }

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

  subscribe(listener: EventListener<TEvent>): () => void {
    return this.on("*", listener);
  }
}
