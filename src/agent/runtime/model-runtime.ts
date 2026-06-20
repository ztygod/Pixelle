import {LLMClient, type BaseLLMClient} from "../../llm/index.js";
import type {LLMGenerateInput} from "../../llm/types.js";
import {mergeUsage, missingLLMClient} from "../runtime-utils.js";
import type {
  AgentModelRequest,
  AgentModelResponse,
  AgentRuntimeConfig,
} from "../types.js";
import type {AgentMiddlewarePipeline} from "../middleware.js";
import type {AgentObserver} from "./observer.js";
import type {AgentRunState} from "./run-state.js";

/** Dependencies used to invoke the configured language model. */
export type ModelRuntimeOptions = {
  /** Normalized config for model settings and retry/timeout options. */
  config: AgentRuntimeConfig;
  /** Optional model client override. */
  llm?: BaseLLMClient;
  /** Middleware pipeline for model request/response hooks. */
  middleware: AgentMiddlewarePipeline;
  /** Observer used for streaming deltas and model lifecycle hooks. */
  observer: AgentObserver;
};

/** Encapsulates model requests, streaming fallback, usage accounting, and middleware. */
export class ModelRuntime {
  private readonly llm: BaseLLMClient;

  /** Creates a model runtime from an explicit client or normalized LLM config. */
  constructor(private readonly options: ModelRuntimeOptions) {
    this.llm =
      options.llm ??
      (options.config.llm ? new LLMClient(options.config.llm) : missingLLMClient());
  }

  /** Generates one assistant response for the current run and updates run usage/content. */
  async generate(
    input: Omit<LLMGenerateInput, "timeoutMs" | "maxRetries">,
    run: AgentRunState,
  ): Promise<AgentModelResponse> {
    const request = await this.options.middleware.beforeModel(
      {
        ...input,
        timeoutMs: this.options.config.llm?.timeoutMs,
        maxRetries: this.options.config.llm?.maxRetries,
        iteration: run.iteration,
        runId: run.runId,
      },
      run.context,
    );
    const response = await this.generateStreamingModelResponse(request, run);
    const modelResponse = await this.options.middleware.afterModel(
      {
        ...response,
        iteration: run.iteration,
        runId: run.runId,
      },
      run.context,
    );
    run.usage = mergeUsage(run.usage, modelResponse.usage);
    run.content = modelResponse.content || run.content;
    this.options.observer.modelCompleted(run, modelResponse);
    return modelResponse;
  }

  private async generateStreamingModelResponse(
    request: AgentModelRequest,
    run: AgentRunState,
  ): Promise<Omit<AgentModelResponse, "iteration" | "runId">> {
    let streamedContent = "";
    let emittedContent = false;
    let finalResponse: Omit<AgentModelResponse, "iteration" | "runId"> | undefined;

    try {
      for await (const chunk of this.llm.stream(request)) {
        if (chunk.type === "content_delta") {
          streamedContent += chunk.content;
          emittedContent = true;
          this.options.observer.assistantDelta(run, chunk.content);
          continue;
        }

        if (chunk.type === "done") {
          finalResponse = {
            ...chunk.response,
            content: chunk.response.content || streamedContent,
          };
        }
      }
    } catch (error) {
      if (emittedContent) {
        throw error;
      }

      return this.llm.generate(request);
    }

    return finalResponse ?? this.llm.generate(request);
  }
}

/** Creates the default model runtime. */
export function createModelRuntime(options: ModelRuntimeOptions): ModelRuntime {
  return new ModelRuntime(options);
}
