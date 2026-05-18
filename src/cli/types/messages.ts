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
  createdAt: number;
  completedAt?: number;
};

export type ImagePreviewState = {
  id: string;
  path: string;
  alt?: string;
  createdAt: number;
};
