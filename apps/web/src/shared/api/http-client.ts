import {env} from "@/shared/config/env";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function requestJson<TResponse>(
  path: string,
  init: RequestInit = {},
): Promise<TResponse> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const body = await readResponseBody(response);
    throw new ApiError(response.statusText, response.status, body);
  }

  return (await response.json()) as TResponse;
}

async function readResponseBody(response: Response) {
  const text = await response.text();

  if (!text) {
    return undefined;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
