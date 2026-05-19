/**
 * Optional context carried with an event.
 *
 * Keep this infrastructure-level: correlation IDs, trace IDs, source names,
 * and small tags are good fits. Domain payload should stay on the event body.
 */
export type EventMetadata = Readonly<{
  source?: string;
  traceId?: string;
  correlationId?: string;
  parentId?: string;
  tags?: readonly string[];
  [key: string]: unknown;
}>;

/**
 * Minimal shape required by EventBus.
 *
 * `createdAt` is optional for producers because EventBus fills it in during
 * `emit()`. Listeners receive `PublishedEvent`, where `createdAt` is required.
 */
export type BaseEvent<
  TType extends string = string,
  TMetadata extends EventMetadata = EventMetadata,
> = {
  type: TType;
  createdAt?: number;
  metadata?: TMetadata;
};

/**
 * Event shape after it has passed through EventBus.
 */
export type PublishedEvent<TEvent extends BaseEvent> = TEvent & {
  createdAt: number;
};

/**
 * A concrete event type or the wildcard listener key.
 */
export type EventType<TEvent extends BaseEvent> = TEvent["type"] | "*";

export type EventListener<TEvent extends BaseEvent> = (
  event: PublishedEvent<TEvent>,
) => void;

/**
 * Synchronous middleware for small event transforms or filters.
 *
 * Return the event to continue dispatching, or `undefined` to drop it before it
 * reaches history and listeners.
 */
export type EventMiddleware<TEvent extends BaseEvent> = (
  event: PublishedEvent<TEvent>,
) => PublishedEvent<TEvent> | undefined;

/**
 * Selects which in-memory history entries should be replayed.
 */
export type ReplayOptions<TEvent extends BaseEvent = BaseEvent> = {
  limit?: number;
  type?: TEvent["type"];
};
