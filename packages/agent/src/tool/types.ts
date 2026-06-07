import type {z} from "zod";

export type ToolSuccessResult<TData = unknown> = {
  ok: true;
  message: string;
  data: TData;
};

export type ToolErrorResult<TData = unknown> = {
  ok: false;
  message: string;
  code: string;
  data?: TData;
};

export type ToolResult<TData = unknown> =
  | ToolSuccessResult<TData>
  | ToolErrorResult;

export type ToolParameterSchema = z.ZodTypeAny;

export type ToolDefinition = {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
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

export type ToolExecute<
  TParameters extends ToolParameterSchema = ToolParameterSchema,
  TResult = unknown,
> = (
  input: z.infer<TParameters>,
  context: ToolContext,
) => Promise<ToolResult<TResult>> | ToolResult<TResult>;

export type Tool<
  TParameters extends ToolParameterSchema = ToolParameterSchema,
  TResult = unknown,
> = {
  definition: ToolDefinition & {parameters: TParameters};
  execute: ToolExecute<TParameters, TResult>;
};
