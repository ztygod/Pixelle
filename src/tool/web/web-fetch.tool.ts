import {z} from "zod";

import {ToolError} from "../tool-error.js";
import {okToolResult} from "../tool-result.js";
import type {Tool, ToolContext} from "../types.js";

/** Successful data returned by the built-in web_fetch tool. */
export type WebFetchResultData = {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  statusText: string;
  contentType: string | null;
  contentLength: number | null;
  text: string;
  truncated: boolean;
  maxLength: number;
};

/** Structured failure details returned by the built-in web_fetch tool. */
export type WebFetchFailureDetails = Omit<
  WebFetchResultData,
  "text" | "truncated" | "maxLength"
>;

export const DEFAULT_WEB_FETCH_MAX_LENGTH = 20_000;
export const MAX_WEB_FETCH_MAX_LENGTH = 200_000;
export const DEFAULT_WEB_FETCH_TIMEOUT_MS = 15_000;
export const MAX_WEB_FETCH_TIMEOUT_MS = 60_000;

const webFetchParameters = z.object({
  reason: z
    .string()
    .describe(
      "Explain why you are calling this tool and what you expect to learn or change.",
    ),
  url: z
    .string()
    .url()
    .describe(
      "Specific HTTP or HTTPS URL to fetch. The caller must already know the URL.",
    ),
  maxLength: z
    .number()
    .int()
    .positive()
    .max(MAX_WEB_FETCH_MAX_LENGTH)
    .optional()
    .describe("Maximum number of characters of response text to return."),
  timeoutMs: z
    .number()
    .int()
    .positive()
    .max(MAX_WEB_FETCH_TIMEOUT_MS)
    .optional()
    .describe("Maximum time in milliseconds to wait for the HTTP request."),
});

/** Tool that fetches text from a known HTTP(S) URL when network permission is granted. */
export const webFetchTool: Tool<typeof webFetchParameters, WebFetchResultData> = {
  definition: {
    name: "web_fetch",
    description:
      "Read text from a specific known HTTP or HTTPS URL. Use this only when the caller already has the exact URL. This tool does not search, discover pages, crawl, or recursively fetch links. Returns HTTP metadata and capped response text. Requires network permission.",
    parameters: webFetchParameters,
  },
  async execute(input, context) {
    requireNetworkPermission(context, "web_fetch");

    const requestedUrl = parseHttpUrl(input.url, "web_fetch");
    const maxLength = input.maxLength ?? DEFAULT_WEB_FETCH_MAX_LENGTH;
    const timeoutMs = input.timeoutMs ?? DEFAULT_WEB_FETCH_TIMEOUT_MS;
    const control = createFetchControl(context.signal, timeoutMs);

    try {
      const response = await fetch(requestedUrl, {signal: control.signal});
      const details = getResponseDetails(response, requestedUrl);

      if (!response.ok) {
        throw new ToolError({
          code: "TOOL_EXECUTION_FAILED",
          message: `web_fetch failed with HTTP ${response.status}.`,
          toolName: "web_fetch",
          details,
        });
      }

      if (!isTextContentType(details.contentType)) {
        throw new ToolError({
          code: "TOOL_EXECUTION_FAILED",
          message: contentTypeErrorMessage(details.contentType),
          toolName: "web_fetch",
          details,
        });
      }

      const {text, truncated} = await readResponseTextWithLimit(response, maxLength);

      return okToolResult(
        "Fetched webpage text.",
        {
          ...details,
          text,
          truncated,
          maxLength,
        },
        {
          kind: "network",
          title: details.finalUrl,
          target: details.finalUrl,
          summary: `${details.status} ${details.statusText || "OK"} · ${details.contentType ?? "unknown content type"}`,
          preview: text,
          stats: {
            status: details.status,
            characters: text.length,
            maxLength,
          },
          truncated,
        },
      );
    } catch (error) {
      throw normalizeFetchError(error, {
        requestedUrl,
        timedOut: control.timedOut,
        contextSignal: context.signal,
        timeoutMs,
      });
    } finally {
      control.cleanup();
    }
  },
};

/** Ensures the current run granted network access before issuing a fetch. */
function requireNetworkPermission(context: ToolContext, toolName: string): void {
  if (!context.permissions?.network) {
    throw new ToolError({
      code: "TOOL_PERMISSION_DENIED",
      message: "Network permission is required.",
      toolName,
    });
  }
}

/** Parses and normalizes an HTTP(S) URL, rejecting unsupported protocols. */
function parseHttpUrl(url: string, toolName: string): string {
  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      throw new Error("Unsupported protocol.");
    }

    return parsedUrl.toString();
  } catch (error) {
    throw new ToolError({
      code: "TOOL_INVALID_INPUT",
      message: "web_fetch requires a valid HTTP or HTTPS URL.",
      toolName,
      cause: error,
    });
  }
}

function getResponseDetails(
  response: Response,
  requestedUrl: string,
): WebFetchFailureDetails {
  const contentType = response.headers.get("content-type");

  return {
    requestedUrl,
    finalUrl: response.url || requestedUrl,
    status: response.status,
    statusText: response.statusText,
    contentType,
    contentLength: parseContentLength(response.headers.get("content-length")),
  };
}

function parseContentLength(value: string | null): number | null {
  if (value === null) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function isTextContentType(contentType: string | null): boolean {
  if (contentType === null) {
    return false;
  }

  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase();

  return (
    mediaType.startsWith("text/") ||
    mediaType === "application/json" ||
    mediaType === "application/xml" ||
    mediaType === "application/xhtml+xml" ||
    mediaType === "application/javascript" ||
    mediaType === "image/svg+xml"
  );
}

function contentTypeErrorMessage(contentType: string | null): string {
  return contentType === null
    ? "web_fetch refused to read a response without a text content type."
    : `web_fetch refused to read non-text response content type "${contentType}".`;
}

function createFetchControl(
  contextSignal: AbortSignal | undefined,
  timeoutMs: number,
): {
  signal: AbortSignal;
  timedOut: () => boolean;
  cleanup: () => void;
} {
  const controller = new AbortController();
  let didTimeOut = false;

  const abortFromContext = (): void => controller.abort();

  if (contextSignal?.aborted) {
    controller.abort();
  } else {
    contextSignal?.addEventListener("abort", abortFromContext, {once: true});
  }

  const timeout = setTimeout(() => {
    didTimeOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    timedOut: () => didTimeOut,
    cleanup: () => {
      if (timeout) {
        clearTimeout(timeout);
      }

      contextSignal?.removeEventListener("abort", abortFromContext);
    },
  };
}

async function readResponseTextWithLimit(
  response: Response,
  maxLength: number,
): Promise<{text: string; truncated: boolean}> {
  const reader = response.body?.getReader();

  if (!reader) {
    // Compatibility path for fetch mocks or runtimes without stream readers.
    const text = await response.text();

    return {
      text: text.slice(0, maxLength),
      truncated: text.length > maxLength,
    };
  }

  const decoder = new TextDecoder();
  let text = "";
  let truncated = false;

  try {
    while (true) {
      const {done, value} = await reader.read();

      if (done) {
        text += decoder.decode();
        break;
      }

      text += decoder.decode(value, {stream: true});

      if (text.length > maxLength) {
        text = text.slice(0, maxLength);
        truncated = true;
        await reader.cancel();
        break;
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {text, truncated};
}

function normalizeFetchError(
  error: unknown,
  input: {
    requestedUrl: string;
    timedOut: () => boolean;
    contextSignal?: AbortSignal;
    timeoutMs: number;
  },
): unknown {
  if (error instanceof ToolError) {
    return error;
  }

  if (isAbortLikeError(error) || input.timedOut() || input.contextSignal?.aborted) {
    if (input.timedOut()) {
      return new ToolError({
        code: "TOOL_TIMEOUT",
        message: `web_fetch timed out after ${input.timeoutMs}ms.`,
        toolName: "web_fetch",
        details: {requestedUrl: input.requestedUrl, timeoutMs: input.timeoutMs},
        cause: error,
      });
    }

    return new ToolError({
      code: "TOOL_ABORTED",
      message: "web_fetch was aborted.",
      toolName: "web_fetch",
      details: {requestedUrl: input.requestedUrl},
      cause: error,
    });
  }

  return new ToolError({
    code: "TOOL_EXECUTION_FAILED",
    message: "web_fetch network request failed.",
    toolName: "web_fetch",
    details: {requestedUrl: input.requestedUrl},
    cause: error,
  });
}

function isAbortLikeError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
