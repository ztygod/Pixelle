export type Brand<TValue, TBrand extends string> = TValue & {
  readonly __brand: TBrand;
};

export type SessionId = Brand<string, "SessionId">;
export type ProjectId = Brand<string, "ProjectId">;
export type MessageId = Brand<string, "MessageId">;

export type AgentStage = "thinking" | "planning" | "executing" | "complete";

export type WorkspaceFile = {
  path: string;
  content: string;
  language?: string;
  modified?: boolean;
};
