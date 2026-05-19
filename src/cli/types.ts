import type {BaseEvent, EventBus} from "../eventsbus/index.js";

export type CliEvent =
  | (BaseEvent<"user_message"> & {
      id?: string;
      content: string;
    })
  | (BaseEvent<"assistant_delta"> & {
      messageId: string;
      delta: string;
    })
  | (BaseEvent<"assistant_done"> & {
      messageId: string;
    })
  | (BaseEvent<"tool_start"> & {
      id: string;
      name: string;
      input?: unknown;
      description?: string;
    })
  | (BaseEvent<"tool_done"> & {
      id: string;
      name: string;
      output?: unknown;
      summary?: string;
    })
  | (BaseEvent<"tool_error"> & {
      id: string;
      name: string;
      error: string;
    })
  | (BaseEvent<"image_preview"> & {
      id?: string;
      path: string;
      alt?: string;
    })
  | (BaseEvent<"error"> & {
      message: string;
      detail?: unknown;
    });

export type UserInputEvent = BaseEvent<"submit"> & {
  content: string;
};

export type MessageRole = "user" | "assistant" | "error";

export type CliMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  order: number;
  streaming?: boolean;
};

export type ToolCallStatus = "running" | "done" | "error";

export type ToolCallState = {
  id: string;
  name: string;
  status: ToolCallStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  description?: string;
  summary?: string;
  createdAt: number;
  order: number;
  completedAt?: number;
};

export type ImagePreviewState = {
  id: string;
  path: string;
  alt?: string;
  createdAt: number;
  order: number;
};

export type RenderCliOptions = {
  title?: string;
  initialEvents?: CliEvent[];
};

export type CliHandle = {
  pushEvent(event: CliEvent): void;
  onUserInput(callback: (input: UserInputEvent) => void): () => void;
  unmount(): void;
};

export type CliEventBus = EventBus<CliEvent>;
export type UserInputBus = EventBus<UserInputEvent>;
