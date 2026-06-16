import type {ToolErrorResult, ToolResult, ToolSuccessResult} from "./types.js";

/** Creates the standard success result returned by tool implementations. */
export function okToolResult<TData>(
  message: string,
  data: TData,
): ToolSuccessResult<TData> {
  return {
    ok: true,
    message,
    data,
  };
}

/** Creates the standard error result returned by tools for model-visible failures. */
export function errorToolResult<TData = unknown>(
  message: string,
  code: string,
  data?: TData,
): ToolErrorResult<TData> {
  return {
    ok: false,
    message,
    code,
    ...(data === undefined ? {} : {data}),
  };
}

export type {ToolErrorResult, ToolResult, ToolSuccessResult};
