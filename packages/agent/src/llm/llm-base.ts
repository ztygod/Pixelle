import type {GenerateInput, GenerateResult} from "./types.js";

/**
 * BaseLLMClient defines the smallest shared contract every provider must obey.
 *
 * It deliberately does not expose convertMessages(), convertTools(), or
 * parseResponse() as abstract methods. Those steps are provider implementation
 * details, and forcing every SDK into the same conversion lifecycle would make
 * this base class an early over-abstraction. Runtime only needs generate().
 */
export abstract class BaseLLMClient {
  abstract generate(input: GenerateInput): Promise<GenerateResult>;

  protected async withTimeout<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    timeoutMs: number,
  ): Promise<T> {
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new LLMTimeoutError(timeoutMs));
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
}

export class LLMTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`LLM request timed out after ${timeoutMs}ms.`);
    this.name = "LLMTimeoutError";
  }
}
