import type {BaseEvent, EventBus} from "../events/index.js";

export type RuntimeCommandEvent = BaseEvent<"runtime_command"> & {
  command: string;
  args: readonly string[];
  raw: string;
};

export type CliEvent =
  | BaseEvent<"cli_clear">
  | BaseEvent<"cli_debug_toggle">
  | BaseEvent<"cli_help_toggle">
  | RuntimeCommandEvent
  | (BaseEvent<"user_message"> & {
      id?: string;
      content: string;
    })
  | (BaseEvent<"assistant_delta"> & {
      messageId: string;
      delta: string;
      stage?: AgentStage;
    })
  | (BaseEvent<"assistant_stage"> & {
      messageId: string;
      stage: AgentStage;
    })
  | (BaseEvent<"assistant_done"> & {
      messageId: string;
    })
  | (BaseEvent<"tool_start"> & {
      id: string;
      name: string;
      input?: unknown;
      description?: string;
      status?: Extract<ToolCallStatus, "pending" | "running">;
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

export type AgentStage = "thinking" | "planning" | "executing" | "complete";

export type CliMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
  order: number;
  streaming?: boolean;
  stage?: AgentStage;
};

export type ToolCallStatus = "pending" | "running" | "success" | "done" | "error";

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
  startedAt?: number;
  completedAt?: number;
  durationMs?: number;
  collapsed?: boolean;
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
  onRuntimeCommand(callback: (command: RuntimeCommandEvent) => void): () => void;
  unmount(): void;
};

export type CliEventBus = EventBus<CliEvent>;
export type UserInputBus = EventBus<UserInputEvent>;
