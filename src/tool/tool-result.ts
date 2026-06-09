import type {ToolErrorResult, ToolResult, ToolSuccessResult} from "./types.js";

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
