import type {ToolErrorResult, ToolResult, ToolSuccessResult} from "./types.js";

/** Creates the standard success result returned by tool implementations. */
export function okToolResult<TData>(
  message: string,
  data: TData,
  display?: ToolSuccessResult<TData>["display"],
): ToolSuccessResult<TData> {
  return {
    ok: true,
    message,
    data,
    ...(display === undefined ? {} : {display}),
  };
}

/** Creates the standard error result returned by tools for model-visible failures. */
export function errorToolResult<TData = unknown>(
  message: string,
  code: string,
  data?: TData,
  display?: ToolErrorResult<TData>["display"],
): ToolErrorResult<TData> {
  return {
    ok: false,
    message,
    code,
    ...(data === undefined ? {} : {data}),
    ...(display === undefined ? {} : {display}),
  };
}

export type {ToolErrorResult, ToolResult, ToolSuccessResult};
