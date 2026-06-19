import type {z} from "zod";
import type {CommandPolicyLike, WorkspaceProfile} from "../runtime/index.js";

/** Successful result returned by a tool after completing its work. */
export type ToolSuccessResult<TData = unknown> = {
  ok: true;
  message: string;
  data: TData;
  display?: ToolResultDisplay;
};

/** Error result returned by a tool when the failure should be reported to the model. */
export type ToolErrorResult<TData = unknown> = {
  ok: false;
  message: string;
  code: string;
  data?: TData;
  display?: ToolResultDisplay;
};

/** Normalized result shape produced by every tool implementation. */
export type ToolResult<TData = unknown> = ToolSuccessResult<TData> | ToolErrorResult;

export type ToolResultDisplayKind =
  | "command"
  | "file"
  | "edit"
  | "search"
  | "list"
  | "network"
  | "text"
  | "json";

/** Optional UI-oriented metadata tools can return without changing their data contract. */
export type ToolResultDisplay = {
  kind?: ToolResultDisplayKind;
  title?: string;
  target?: string;
  summary?: string;
  preview?: string;
  stats?: Record<string, string | number | boolean>;
  truncated?: boolean;
};

/** Incremental output chunk emitted while a tool is still running. */
export type ToolStreamChunk =
  | {
      type: "stdout" | "stderr" | "log";
      content: string;
      level?: "debug" | "info" | "warn" | "error";
      metadata?: Record<string, unknown>;
    }
  | {
      type: "data";
      data?: unknown;
      content?: string;
      metadata?: Record<string, unknown>;
    }
  | {
      type: "progress";
      label?: string;
      current?: number;
      total?: number;
      percent?: number;
      metadata?: Record<string, unknown>;
    };

/** Zod schema used to validate model-provided tool input before execution. */
export type ToolParameterSchema = z.ZodTypeAny;

/** Public description and input schema exposed to LLM providers. */
export type ToolDefinition = {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
};

/** Runtime capabilities granted to tools for the current agent run. */
export type ToolPermissions = {
  readFile?: boolean;
  writeFile?: boolean;
  network?: boolean;
  shell?: boolean;
};

/** Optional writer abstraction used by the agent to track file changes. */
export type ToolFileWriter = {
  writeFile(
    relativePath: string,
    content: string,
  ): Promise<{path: string; bytesWritten: number}>;
};

/** Execution context shared with tools by ToolRunner. */
export type ToolContext = {
  workspaceRoot: string;
  signal?: AbortSignal;
  permissions?: ToolPermissions;
  fileWriter?: ToolFileWriter;
  workspaceProfile?: WorkspaceProfile;
  commandPolicy?: CommandPolicyLike;
  emitStream?: (chunk: ToolStreamChunk) => void | Promise<void>;
};

/** Implementation function for a tool after ToolRunner validates its input. */
export type ToolExecute<
  TParameters extends ToolParameterSchema = ToolParameterSchema,
  TResult = unknown,
> = (
  input: z.infer<TParameters>,
  context: ToolContext,
) => Promise<ToolResult<TResult>> | ToolResult<TResult>;

/** Runtime tool contract registered with ToolRegistry and executed by ToolRunner. */
export type Tool<
  TParameters extends ToolParameterSchema = ToolParameterSchema,
  TResult = unknown,
> = {
  definition: ToolDefinition & {parameters: TParameters};
  execute: ToolExecute<TParameters, TResult>;
};
