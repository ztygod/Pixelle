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
      target?: string;
      input?: unknown;
      description?: string;
      status?: Extract<ToolCallStatus, "pending" | "running">;
    })
  | (BaseEvent<"tool_done"> & {
      id: string;
      name: string;
      target?: string;
      output?: unknown;
      summary?: string;
      display?: ToolResultDisplayState;
    })
  | (BaseEvent<"tool_error"> & {
      id: string;
      name: string;
      target?: string;
      error: string;
      code?: string;
      data?: unknown;
      display?: ToolResultDisplayState;
    })
  | (BaseEvent<"tool_stream"> & {
      id: string;
      name: string;
      stream: ToolStreamState;
    })
  | (BaseEvent<"image_preview"> & {
      id?: string;
      path: string;
      alt?: string;
    })
  | (BaseEvent<"change_set"> & {
      id: string;
      files: readonly ChangedFileState[];
      checkpointPath?: string;
    })
  | (BaseEvent<"verification"> & {
      status: "running" | "passed" | "failed";
      commands: readonly string[];
    })
  | (BaseEvent<"trace"> & {
      path: string;
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

export type ToolResultDisplayState = {
  title?: string;
  summary?: string;
  preview?: string;
  stats?: Record<string, string | number>;
  truncated?: boolean;
};

export type ToolStreamState = {
  type: "stdout" | "stderr" | "data";
  content: string;
  metadata?: Record<string, unknown>;
};

export type ToolCallState = {
  id: string;
  name: string;
  target?: string;
  status: ToolCallStatus;
  input?: unknown;
  output?: unknown;
  error?: string;
  errorCode?: string;
  errorData?: unknown;
  description?: string;
  summary?: string;
  display?: ToolResultDisplayState;
  streams?: ToolStreamState[];
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

export type ChangedFileState = {
  path: string;
  beforeContent?: string;
  afterContent?: string;
  status: "created" | "modified" | "deleted";
};

export type ChangeSetState = {
  id: string;
  files: readonly ChangedFileState[];
  checkpointPath?: string;
  createdAt: number;
  order: number;
};

export type VerificationState = {
  id: string;
  status: "running" | "passed" | "failed";
  commands: readonly string[];
  createdAt: number;
  order: number;
};

export type TraceState = {
  id: string;
  path: string;
  createdAt: number;
  order: number;
};

export type RenderCliOptions = {
  title?: string;
  cwd?: string;
  model?: string;
  provider?: string;
  gitBranch?: string;
  gitStatus?: "clean" | "modified" | "unknown";
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
