import type {
  AgentContextProvider,
  AgentContextValue,
  AgentRunContext,
} from "../../agent/types.js";

export type ProviderExecutionResult = {
  provider: AgentContextProvider;
  value?: AgentContextValue;
  error?: Error;
  durationMs: number;
  success: boolean;
};

/**
 * Executes context providers with isolation.
 *
 * Responsibilities:
 * - Execute providers concurrently.
 * - Handle provider failures independently.
 * - Apply timeout policies.
 * - Collect execution metrics.
 *
 * Not responsible for:
 * - Converting provider results into ContextSection.
 * - Deciding whether a provider failure is critical.
 */
export class ContextProviderExecutor {
  async execute(
    providers: readonly AgentContextProvider[],
    context: AgentRunContext,
  ): Promise<ProviderExecutionResult[]> {
    return Promise.all(
      providers.map((provider) => this.executeProvider(provider, context)),
    );
  }

  private async executeProvider(
    provider: AgentContextProvider,
    context: AgentRunContext,
  ): Promise<ProviderExecutionResult> {
    const start = Date.now();
    const controller = new AbortController();

    try {
      const value = await this.withTimeout(
        provider.build(context, {signal: controller.signal}),
        provider.timeoutMs,
        provider.name,
      );

      return {
        provider,
        value,
        success: true,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      return {
        provider,
        error: error instanceof Error ? error : new Error(String(error)),
        success: false,
        durationMs: Date.now() - start,
      };
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs?: number,
    providerName?: string,
  ): Promise<T> {
    /**
     * If the provider does not define a timeout,
     * wait for the provider execution directly.
     */
    if (!timeoutMs) {
      return promise;
    }

    return Promise.race([
      promise,

      new Promise<T>((_, reject) => {
        const timer = setTimeout(() => {
          reject(
            new Error(`Context provider "${providerName}" timeout after ${timeoutMs}ms`),
          );
        }, timeoutMs);

        /**
         * In Node.js environments:
         * prevent the timer from keeping the process alive.
         */
        timer.unref?.();
      }),
    ]);
  }
}
