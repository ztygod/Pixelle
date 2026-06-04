import type {LLMProvider} from "./types.js";

/** Stable error code values for LLM failures. */
export type LLMErrorCode =
  | "llm_error"
  | "llm_timeout"
  | "llm_rate_limit"
  | "llm_auth"
  | "llm_network"
  | "llm_model"
  | "llm_response_format"
  | "llm_unsupported_feature";

/** Metadata attached to normalized LLM errors. */
export type LLMErrorOptions = {
  code?: LLMErrorCode;
  provider?: LLMProvider;
  status?: number;
  model?: string;
  retryable?: boolean;
  cause?: unknown;
};

/** Base error class for all normalized LLM provider failures. */
export class LLMError extends Error {
  readonly code: LLMErrorCode;
  readonly provider?: LLMProvider;
  readonly status?: number;
  readonly model?: string;
  readonly retryable: boolean;

  constructor(message: string, options: LLMErrorOptions = {}) {
    super(message, {cause: options.cause});
    this.name = "LLMError";
    this.code = options.code ?? "llm_error";
    this.provider = options.provider;
    this.status = options.status;
    this.model = options.model;
    this.retryable = options.retryable ?? false;
  }
}

/** Raised when an LLM request exceeds its timeout. */
export class LLMTimeoutError extends LLMError {
  constructor(timeoutMs: number, options: Omit<LLMErrorOptions, "code"> = {}) {
    super(`LLM request timed out after ${timeoutMs}ms.`, {
      ...options,
      code: "llm_timeout",
      retryable: true,
    });
    this.name = "LLMTimeoutError";
  }
}

/** Raised when a provider returns a rate-limit response. */
export class LLMRateLimitError extends LLMError {
  constructor(message = "LLM provider rate limit exceeded.", options: Omit<LLMErrorOptions, "code"> = {}) {
    super(message, {
      ...options,
      code: "llm_rate_limit",
      retryable: true,
    });
    this.name = "LLMRateLimitError";
  }
}

/** Raised when provider authentication fails. */
export class LLMAuthError extends LLMError {
  constructor(message = "LLM provider authentication failed.", options: Omit<LLMErrorOptions, "code"> = {}) {
    super(message, {
      ...options,
      code: "llm_auth",
      retryable: false,
    });
    this.name = "LLMAuthError";
  }
}

/** Raised for retryable network or upstream availability failures. */
export class LLMNetworkError extends LLMError {
  constructor(message = "LLM provider network request failed.", options: Omit<LLMErrorOptions, "code"> = {}) {
    super(message, {
      ...options,
      code: "llm_network",
      retryable: true,
    });
    this.name = "LLMNetworkError";
  }
}

/** Raised when the requested model is unavailable or invalid. */
export class LLMModelError extends LLMError {
  constructor(message = "LLM model is unavailable or unsupported.", options: Omit<LLMErrorOptions, "code"> = {}) {
    super(message, {
      ...options,
      code: "llm_model",
      retryable: false,
    });
    this.name = "LLMModelError";
  }
}

/** Raised when a provider response cannot be normalized safely. */
export class LLMResponseFormatError extends LLMError {
  constructor(message = "LLM provider returned an unexpected response format.", options: Omit<LLMErrorOptions, "code"> = {}) {
    super(message, {
      ...options,
      code: "llm_response_format",
      retryable: false,
    });
    this.name = "LLMResponseFormatError";
  }
}

/** Raised when a provider cannot support a requested LLM feature. */
export class LLMUnsupportedFeatureError extends LLMError {
  constructor(message: string, options: Omit<LLMErrorOptions, "code"> = {}) {
    super(message, {
      ...options,
      code: "llm_unsupported_feature",
      retryable: false,
    });
    this.name = "LLMUnsupportedFeatureError";
  }
}
