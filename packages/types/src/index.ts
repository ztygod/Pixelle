export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type SessionId = Brand<string, "SessionId">;
export type ProjectId = Brand<string, "ProjectId">;
export type MessageId = Brand<string, "MessageId">;
export type ToolCallId = Brand<string, "ToolCallId">;

export type AgentStage = "thinking" | "planning" | "executing" | "complete";

export type ToolCallStatus =
  | "pending"
  | "running"
  | "success"
  | "done"
  | "error";

export type RuntimeConnectionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type WorkspaceFile = {
  path: string;
  content: string;
  language?: string;
  modified?: boolean;
};

export type PatchSummary = {
  id: string;
  title: string;
  filesChanged: number;
  additions?: number;
  deletions?: number;
};
