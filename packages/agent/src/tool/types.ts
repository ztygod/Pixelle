export type ToolDefinition = {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
};

export type ToolPermissions = {
  readFile?: boolean;
  writeFile?: boolean;
  network?: boolean;
};

export type ToolContext = {
  workspaceRoot: string;
  signal?: AbortSignal;
  permissions?: ToolPermissions;
};

export type ToolExecute<TInput = unknown, TResult = unknown> = (
  input: TInput,
  context: ToolContext,
) => Promise<TResult> | TResult;

export type Tool<TInput = unknown, TResult = unknown> = {
  definition: ToolDefinition;
  execute: ToolExecute<TInput, TResult>;
};
