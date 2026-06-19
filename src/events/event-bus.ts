type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

type SessionId = Brand<string, "SessionId">;
type MessageId = Brand<string, "MessageId">;
type ToolCallId = Brand<string, "ToolCallId">;

type AgentStage = "thinking" | "planning" | "executing" | "complete";

type ToolCallStatus = "pending" | "running" | "success" | "done" | "error";

type ToolResultDisplay = {
  kind?: "command" | "file" | "edit" | "search" | "list" | "network" | "text" | "json";
  title?: string;
  target?: string;
  summary?: string;
  preview?: string;
  stats?: Record<string, string | number | boolean>;
  truncated?: boolean;
};

type ToolStreamChunk =
  | {
      type: "stdout" | "stderr" | "log";
      content: string;
      level?: "debug" | "info" | "warn" | "error";
      metadata?: Record<string, unknown>;
    }
  | {
      type: "data";
      data?: unknown;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "progress";
      label?: string;
      current?: number;
      total?: number;
      percent?: number;
      metadata?: Record<string, unknown>;
    };

type ToolSuccessResult = {
  ok: true;
  message: string;
  data: unknown;
  display?: ToolResultDisplay;
};

type ToolErrorResult = {
  ok: false;
  message: string;
  code: string;
  data?: unknown;
  display?: ToolResultDisplay;
};

type EventChangedFileStatus = "created" | "modified" | "deleted";

type EventChangedFile = {
  path: string;
  beforeHash?: string;
  afterHash?: string;
  beforeContent?: string;
  afterContent?: string;
  status: EventChangedFileStatus;
};

type EventMetadata = Readonly<{
  source?: string;
  traceId?: string;
  correlationId?: string;
  parentId?: string;
  sessionId?: SessionId | string;
  tags?: readonly string[];
  [key: string]: unknown;
}>;

/** Shared shape for every event emitted through Pixelle event buses. */
export type BaseEvent<
  TType extends string = string,
  TMetadata extends EventMetadata = EventMetadata,
> = {
  type: TType;
  createdAt?: number;
  metadata?: TMetadata;
};

type PublishedEvent<TEvent extends BaseEvent> = TEvent & {
  createdAt: number;
};

type EventType<TEvent extends BaseEvent> = TEvent["type"] | "*";

type EventListener<TEvent extends BaseEvent> = (event: PublishedEvent<TEvent>) => void;

type EventMiddleware<TEvent extends BaseEvent> = (
  event: PublishedEvent<TEvent>,
) => PublishedEvent<TEvent> | undefined;

type ReplayOptions<TEvent extends BaseEvent = BaseEvent> = {
  limit?: number;
  type?: TEvent["type"];
};

type AgentEvent =
  | (BaseEvent<"conversation.user_message"> & {
      id?: MessageId | string;
      content: string;
    })
  | (BaseEvent<"conversation.assistant_delta"> & {
      messageId: MessageId | string;
      delta: string;
      stage?: AgentStage;
    })
  | (BaseEvent<"conversation.assistant_stage"> & {
      messageId: MessageId | string;
      stage: AgentStage;
    })
  | (BaseEvent<"conversation.assistant_done"> & {
      messageId: MessageId | string;
    })
  | (BaseEvent<"tool.call_started"> & {
      id: ToolCallId | string;
      name: string;
      target?: string;
      input?: unknown;
      description?: string;
      display?: ToolResultDisplay;
      status?: Extract<ToolCallStatus, "pending" | "running">;
    })
  | (BaseEvent<"tool.call_completed"> & {
      id: ToolCallId | string;
      name: string;
      result?: ToolSuccessResult;
      durationMs?: number;
      target?: string;
      output?: unknown;
      summary?: string;
      display?: ToolResultDisplay;
    })
  | (BaseEvent<"tool.call_failed"> & {
      id: ToolCallId | string;
      name: string;
      result?: ToolErrorResult;
      durationMs?: number;
      target?: string;
      error: string;
      code?: string;
      data?: unknown;
      display?: ToolResultDisplay;
    })
  | (BaseEvent<"tool.call_stream"> & {
      id: ToolCallId | string;
      name: string;
      stream: ToolStreamChunk;
    })
  | (BaseEvent<"runtime.status_changed"> & {
      status: "idle" | "running" | "waiting" | "complete" | "error";
      detail?: string;
    })
  | (BaseEvent<"runtime.error"> & {
      message: string;
      detail?: unknown;
    });

type RuntimeEvent =
  | (BaseEvent<"runtime.session_started"> & {sessionId: SessionId | string})
  | (BaseEvent<"runtime.session_stopped"> & {sessionId: SessionId | string})
  | (BaseEvent<"runtime.step_started"> & {id: string; label: string})
  | (BaseEvent<"runtime.step_completed"> & {id: string; label: string})
  | (BaseEvent<"runtime.step_failed"> & {
      id: string;
      label: string;
      error: string;
    })
  | (BaseEvent<"runtime.context_built"> & {
      tokenEstimate?: number;
      files?: readonly string[];
    })
  | (BaseEvent<"task.started"> & {taskId: string; prompt: string})
  | (BaseEvent<"task.plan_created"> & {taskId: string; steps: readonly string[]})
  | (BaseEvent<"change_set.created"> & {
      id: string;
      files: readonly string[];
    })
  | (BaseEvent<"change_set.applied"> & {
      id: string;
      files: readonly string[];
      changes?: readonly EventChangedFile[];
      checkpointPath?: string;
    })
  | (BaseEvent<"change_set.rollback_started"> & {
      id: string;
    })
  | (BaseEvent<"change_set.rollback_completed"> & {
      id: string;
    })
  | (BaseEvent<"verification.started"> & {
      commands: readonly string[];
    })
  | (BaseEvent<"verification.completed"> & {
      passed: boolean;
      commands: readonly string[];
    })
  | (BaseEvent<"trace.persisted"> & {
      path: string;
    });

/** Event union produced by the agent runtime. */
export type PixelleEvent = AgentEvent | RuntimeEvent;

type EventBusOptions<TEvent extends BaseEvent> = {
  maxHistorySize?: number;
  middleware?: readonly EventMiddleware<TEvent>[];
  now?: () => number;
};

/** In-memory typed pub/sub bus with bounded history and optional middleware. */
export class EventBus<TEvent extends BaseEvent> {
  private readonly listenersByType = new Map<string, Set<EventListener<TEvent>>>();
  private readonly historyBuffer: PublishedEvent<TEvent>[] = [];
  private readonly middleware: EventMiddleware<TEvent>[];
  private readonly maxHistorySize: number;
  private readonly now: () => number;

  constructor(options: EventBusOptions<TEvent> = {}) {
    this.maxHistorySize = options.maxHistorySize ?? 200;
    this.middleware = [...(options.middleware ?? [])];
    this.now = options.now ?? Date.now;
  }

  /** Subscribe to one concrete event type, or "*" for all events. */
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

  /** Remove a listener previously registered with `on`. */
  off(type: EventType<TEvent>, listener: EventListener<TEvent>): void {
    this.listenersByType.get(String(type))?.delete(listener);
  }

  /** Subscribe to the next matching event, then unsubscribe automatically. */
  once(type: EventType<TEvent>, listener: EventListener<TEvent>): () => void {
    const unsubscribe = this.on(type, (event) => {
      unsubscribe();
      listener(event);
    });

    return unsubscribe;
  }

  /** Publish an event, applying middleware and assigning `createdAt` if absent. */
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
      this.historyBuffer.splice(0, this.historyBuffer.length - this.maxHistorySize);
    }

    for (const listener of this.listenersByType.get(publishedEvent.type) ?? []) {
      listener(publishedEvent);
    }
    for (const listener of this.listenersByType.get("*") ?? []) {
      listener(publishedEvent);
    }

    return publishedEvent;
  }

  /** Add middleware that can transform or drop events before listeners see them. */
  use(middleware: EventMiddleware<TEvent>): () => void {
    this.middleware.push(middleware);

    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index >= 0) {
        this.middleware.splice(index, 1);
      }
    };
  }

  /** Drop all retained history without changing active subscriptions. */
  clear(): void {
    this.historyBuffer.length = 0;
  }

  /** Return a snapshot of retained published events. */
  history(): PublishedEvent<TEvent>[] {
    return [...this.historyBuffer];
  }

  /** Replay retained events to a listener, optionally filtered by type and limit. */
  replay(listener: EventListener<TEvent>, options: ReplayOptions<TEvent> = {}): void {
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

  /** Subscribe to every event emitted by this bus. */
  subscribe(listener: EventListener<TEvent>): () => void {
    return this.on("*", listener);
  }
}
