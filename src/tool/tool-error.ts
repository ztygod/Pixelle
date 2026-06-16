/** Stable error codes used by tools and ToolRunner to classify failures. */
export type ToolErrorCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_ALREADY_REGISTERED"
  | "TOOL_PERMISSION_DENIED"
  | "TOOL_APPROVAL_REQUIRED"
  | "TOOL_COMMAND_POLICY_DENIED"
  | "TOOL_INVALID_INPUT"
  | "TOOL_PATH_OUTSIDE_WORKSPACE"
  | "TOOL_EXECUTION_FAILED"
  | "TOOL_TIMEOUT"
  | "TOOL_ABORTED";

/** Constructor options for ToolError with optional tool and detail context. */
export type ToolErrorOptions = {
  code: ToolErrorCode;
  message: string;
  toolName?: string;
  details?: unknown;
  cause?: unknown;
};

/** Structured error thrown by tools when ToolRunner should preserve failure details. */
export class ToolError extends Error {
  readonly code: ToolErrorCode;
  readonly toolName?: string;
  readonly details?: unknown;

  /** Creates a tool error with a stable code and optional cause. */
  constructor(options: ToolErrorOptions) {
    super(options.message, {cause: options.cause});
    this.name = "ToolError";
    this.code = options.code;
    this.toolName = options.toolName;
    this.details = options.details;
  }
}

/** Converts unknown thrown values into a ToolError while preserving existing ToolErrors. */
export function toToolError(
  error: unknown,
  fallback: Omit<ToolErrorOptions, "cause">,
): ToolError {
  if (error instanceof ToolError) {
    return error;
  }

  const message = error instanceof Error ? error.message : fallback.message;

  return new ToolError({
    ...fallback,
    message,
    cause: error,
  });
}
