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
 * - run providers concurrently
 * - handle provider errors
 * - apply timeout policy
 * - collect execution metrics
 *
 * Not responsible for:
 * - converting values to ContextSection
 * - deciding critical provider behavior
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
     * Provider 没有配置 timeout
     * 直接等待
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
         * Node 环境:
         * 防止 timer 阻止进程退出
         */
        timer.unref?.();
      }),
    ]);
  }
}
