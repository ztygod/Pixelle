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
      createdAt?: number;
    }
  | {
      type: "tool_done";
      id: string;
      name: string;
      output?: unknown;
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
