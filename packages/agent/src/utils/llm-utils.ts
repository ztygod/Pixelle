import {
  LLMAuthError,
  LLMError,
  LLMModelError,
  LLMNetworkError,
  LLMRateLimitError,
  LLMTimeoutError,
} from "../llm/errors.js";
import type {LLMClientConfig} from "../llm/types.js";

type RequestOptions = {
  config: LLMClientConfig;
  timeoutMs?: number;
  maxRetries?: number;
};

type Operation<T> = (signal: AbortSignal) => Promise<T>;

/** Runs one LLM request with timeout, retry, and normalized error handling. */
export async function requestWithRetry<T>(
  operation: Operation<T>,
  options: RequestOptions,
): Promise<T> {
  const maxRetries = options.maxRetries ?? options.config.maxRetries;
  let attempt = 0;

  while (true) {
    try {
      return await requestWithTimeout(
        operation,
        options.timeoutMs ?? options.config.timeoutMs,
        options.config,
      );
    } catch (error) {
      const llmError = classifyLLMError(error, options.config);
      if (!llmError.retryable || attempt >= maxRetries) {
        throw llmError;
      }

      await delay(backoffMs(attempt));
      attempt += 1;
    }
  }
}

/** Converts provider or SDK errors into Pixelle LLM error classes. */
export function classifyLLMError(
  error: unknown,
  config: Pick<LLMClientConfig, "provider" | "model">,
): LLMError {
  if (error instanceof LLMError) {
    return error;
  }

  const status = getErrorStatus(error);
  const message = getErrorMessage(error);
  const common = {
    provider: config.provider,
    model: config.model,
    status,
    cause: error,
  };

  if (status === 429) {
    return new LLMRateLimitError(message, common);
  }

  if (status === 401 || status === 403) {
    return new LLMAuthError(message, common);
  }

  if (status === 404 || status === 410) {
    return new LLMModelError(message, common);
  }

  if (status !== undefined && status >= 500) {
    return new LLMNetworkError(message, common);
  }

  if (isAbortError(error)) {
    return new LLMTimeoutError(0, common);
  }

  if (isLikelyNetworkError(error)) {
    return new LLMNetworkError(message, common);
  }

  return new LLMError(message, {
    ...common,
    retryable: false,
  });
}

async function requestWithTimeout<T>(
  operation: Operation<T>,
  timeoutMs: number,
  config: Pick<LLMClientConfig, "provider" | "model">,
): Promise<T> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new LLMTimeoutError(timeoutMs, config));
    }, timeoutMs);
  });

  try {
    return await Promise.race([operation(controller.signal), timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function getErrorStatus(error: unknown): number | undefined {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as {status?: unknown}).status;
    return typeof status === "number" ? status : undefined;
  }

  return undefined;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "LLM provider request failed.";
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function isLikelyNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return ["APIConnectionError", "FetchError"].includes(error.name);
}

function backoffMs(attempt: number): number {
  const baseMs = 250 * 2 ** attempt;
  const jitterMs = Math.floor(Math.random() * 100);
  return Math.min(baseMs + jitterMs, 5_000);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolveDelay) => {
    setTimeout(resolveDelay, ms);
  });
}

