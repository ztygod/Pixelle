export type ToolErrorCode =
  | "TOOL_NOT_FOUND"
  | "TOOL_ALREADY_REGISTERED"
  | "TOOL_PERMISSION_DENIED"
  | "TOOL_INVALID_INPUT"
  | "TOOL_PATH_OUTSIDE_WORKSPACE"
  | "TOOL_EXECUTION_FAILED";

export type ToolErrorOptions = {
  code: ToolErrorCode;
  message: string;
  toolName?: string;
  details?: unknown;
  cause?: unknown;
};

export class ToolError extends Error {
  readonly code: ToolErrorCode;
  readonly toolName?: string;
  readonly details?: unknown;

  constructor(options: ToolErrorOptions) {
    super(options.message, {cause: options.cause});
    this.name = "ToolError";
    this.code = options.code;
    this.toolName = options.toolName;
    this.details = options.details;
  }
}

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
