export type CliEvent =
  | {
      type: "user_message";
      id?: string;
      content: string;
      createdAt?: number;
    }
  | {
      type: "assistant_delta";
      messageId: string;
      delta: string;
      createdAt?: number;
    }
  | {
      type: "assistant_done";
      messageId: string;
      createdAt?: number;
    }
  | {
      type: "tool_start";
      id: string;
      name: string;
      input?: unknown;
      description?: string;
      createdAt?: number;
    }
  | {
      type: "tool_done";
      id: string;
      name: string;
      output?: unknown;
      summary?: string;
      createdAt?: number;
    }
  | {
      type: "tool_error";
      id: string;
      name: string;
      error: string;
      createdAt?: number;
    }
  | {
      type: "image_preview";
      id?: string;
      path: string;
      alt?: string;
      createdAt?: number;
    }
  | {
      type: "error";
      message: string;
      detail?: unknown;
      createdAt?: number;
    };

export type UserInputEvent = {
  type: "submit";
  content: string;
  createdAt: number;
};

export type MessageRole = "user" | "assistant" | "error";

export type CliMessage = {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: number;
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
  completedAt?: number;
};

export type ImagePreviewState = {
  id: string;
  path: string;
  alt?: string;
  createdAt: number;
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

