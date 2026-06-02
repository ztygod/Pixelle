export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type SessionId = Brand<string, "SessionId">;
export type MessageId = Brand<string, "MessageId">;
export type ToolCallId = Brand<string, "ToolCallId">;

export type AgentStage = "thinking" | "planning" | "executing" | "complete";

export type ToolCallStatus =
  | "pending"
  | "running"
  | "success"
  | "done"
  | "error";

export type PatchSummary = {
  id: string;
  title: string;
  filesChanged: number;
  additions?: number;
  deletions?: number;
};

export type EventMetadata = Readonly<{
  source?: string;
  traceId?: string;
  correlationId?: string;
  parentId?: string;
  sessionId?: SessionId | string;
  tags?: readonly string[];
  [key: string]: unknown;
}>;

export type BaseEvent<
  TType extends string = string,
  TMetadata extends EventMetadata = EventMetadata,
> = {
  type: TType;
  createdAt?: number;
  metadata?: TMetadata;
};

export type PublishedEvent<TEvent extends BaseEvent> = TEvent & {
  createdAt: number;
};

export type EventType<TEvent extends BaseEvent> = TEvent["type"] | "*";

export type EventListener<TEvent extends BaseEvent> = (
  event: PublishedEvent<TEvent>,
) => void;

export type EventMiddleware<TEvent extends BaseEvent> = (
  event: PublishedEvent<TEvent>,
) => PublishedEvent<TEvent> | undefined;

export type ReplayOptions<TEvent extends BaseEvent = BaseEvent> = {
  limit?: number;
  type?: TEvent["type"];
};

export type AgentEvent =
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
      input?: unknown;
      description?: string;
      status?: Extract<ToolCallStatus, "pending" | "running">;
    })
  | (BaseEvent<"tool.call_completed"> & {
      id: ToolCallId | string;
      name: string;
      output?: unknown;
      summary?: string;
    })
  | (BaseEvent<"tool.call_failed"> & {
      id: ToolCallId | string;
      name: string;
      error: string;
    })
  | (BaseEvent<"runtime.command_received"> & {
      command: string;
      args: readonly string[];
      raw: string;
    })
  | (BaseEvent<"runtime.status_changed"> & {
      status: "idle" | "running" | "waiting" | "complete" | "error";
      detail?: string;
    })
  | (BaseEvent<"runtime.error"> & {
      message: string;
      detail?: unknown;
    })
  | (BaseEvent<"artifact.image_added"> & {
      id?: string;
      path: string;
      alt?: string;
    })
  | (BaseEvent<"artifact.patch_created"> & {
      patch: PatchSummary;
    })
  | (BaseEvent<"artifact.diff_created"> & {
      id: string;
      title: string;
      diff: string;
    });

export type RuntimeEvent =
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
    });

export type UiEvent =
  | BaseEvent<"ui.clear">
  | BaseEvent<"ui.debug_toggled">
  | BaseEvent<"ui.help_toggled">;

export type PixelleEvent = AgentEvent | RuntimeEvent | UiEvent;



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
