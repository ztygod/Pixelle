import type {LLMGenerateInput, LLMTool} from "../../llm/types.js";
import {SystemPromptService, type ResolvedSystemPrompt} from "../prompt/index.js";
import {
  ContextCollector,
  ContextWindowExceededError,
  createDefaultContextPipeline,
  type BuildContextDiagnostics,
  type ContextPipelineLike,
  type ContextDocument,
  type ContextDocumentMetadata,
  type ContextSection,
} from "../../context/index.js";
import type {
  AgentModelResponse,
  AgentRuntimeConfig,
  AgentToolResult,
  AgentContextProvider,
} from "../types.js";
import {stringifyToolResult} from "../runtime-utils.js";
import type {AgentMemory} from "./memory.js";
import type {AgentObserver} from "./observer.js";
import type {AgentRunState} from "./run-state.js";

/**
 * Dependencies used to build and maintain the model transcript.
 *
 * ContextManager coordinates context collection, transformation, and lifecycle
 * management before sending a request to the language model.
 */
export type ContextManagerOptions = {
  /**
   * Normalized agent configuration used for prompt generation,
   * context policies, and token-limit constraints.
   */
  config: AgentRuntimeConfig;

  /**
   * Memory implementation responsible for loading and managing
   * persistent contextual knowledge across agent runs.
   */
  memory: AgentMemory;

  /**
   * Observer used to emit context lifecycle events, such as
   * context building, compression, truncation, and completion.
   */
  observer: AgentObserver;

  /**
   * Agent-level context providers executed during each run to
   * collect additional runtime context.
   *
   * Examples:
   * - workspace information
   * - environment metadata
   * - external knowledge sources
   */
  contextProviders?: readonly AgentContextProvider[];

  /**
   * Component responsible for collecting raw context sources
   * required to build the model transcript.
   */
  collector?: ContextCollector;

  /**
   * Pipeline responsible for transforming collected context into
   * a model-ready transcript.
   *
   * Handles operations such as:
   * - transcript projection
   * - token budgeting
   * - context compression
   * - truncation
   * - prompt assembly
   */
  pipeline?: ContextPipelineLike;

  /**
   * Service responsible for resolving and building the system prompt
   * used for the current agent execution.
   */
  systemPromptService?: SystemPromptService;
};

export type BuildModelRequestOptions = {
  stage: ContextDocumentMetadata["stage"];
  additionalSections?: readonly ContextSection[];
  tools?: readonly LLMTool[];
};

/** Builds model context and owns transcript mutation for assistant/tool turns. */
export class ContextManager {
  private readonly collector: ContextCollector;
  private readonly pipeline: ContextPipelineLike;
  private readonly systemPromptService: SystemPromptService;
  private readonly runStates = new WeakMap<AgentRunState, ContextManagerRunState>();

  /** Creates a context manager with static agent-level context providers. */
  constructor(private readonly options: ContextManagerOptions) {
    this.collector =
      options.collector ??
      new ContextCollector({
        memory: options.memory,
        contextProviders: options.contextProviders,
      });
    this.pipeline =
      options.pipeline ?? createDefaultContextPipeline({llmConfig: options.config.llm});
    this.systemPromptService = options.systemPromptService ?? new SystemPromptService();
  }

  /** Initializes static context sources and the mutable transcript for a run. */
  async prepare(run: AgentRunState): Promise<void> {
    const prompt = this.resolveSystemPrompt(run);
    const document = await this.collector.collect(run);
    this.initializeRunState(run, document, prompt);
    run.messages.push(...(run.input.messages ?? []));
    run.messages.push({role: "user", content: run.input.prompt});
  }

  /** Builds a fresh model transcript with dynamic runtime context. */
  async buildModelRequest(
    run: AgentRunState,
    options: BuildModelRequestOptions,
  ): Promise<LLMGenerateInput> {
    const state = this.getRunState(run);
    const document: ContextDocument = {
      ...state.document,
      sections: [...state.document.sections, ...(options.additionalSections ?? [])],
      transcript: run.messages,
      metadata: {
        ...state.document.metadata,
        iteration: run.iteration,
        stage: options.stage,
      },
    };
    try {
      const result = await this.pipeline.build({
        document,
        resolvedSystemPrompt: state.prompt,
        tools: options.tools,
        tokenLimit: this.options.config.runtime.tokensLimit,
      });
      this.recordAndObserveContextBuild(run, state, result.diagnostics);
      if (result.compacted) {
        this.options.observer.contextCompacted(run, result.diagnostics);
      }
      return result.request;
    } catch (error) {
      if (error instanceof ContextWindowExceededError && error.diagnostics) {
        this.recordAndObserveContextBuild(run, state, error.diagnostics);
        this.options.observer.contextBudgetFailed(run, error.diagnostics);
      }
      throw error;
    }
  }

  /** Appends a normalized assistant response to the transcript. */
  appendAssistantResponse(run: AgentRunState, response: AgentModelResponse): void {
    run.messages.push({
      role: "assistant",
      content: response.content,
      toolCalls: response.toolCalls,
    });
  }

  /** Appends model-readable tool result messages to the transcript. */
  appendToolResults(run: AgentRunState, toolResults: readonly AgentToolResult[]): void {
    for (const toolResult of toolResults) {
      run.messages.push({
        role: "tool",
        toolCallId: toolResult.call.id,
        name: toolResult.call.name,
        content: stringifyToolResult(toolResult.result),
      });
    }
  }

  /** Gives the memory implementation a chance to persist run knowledge. */
  async save(run: AgentRunState): Promise<void> {
    await this.options.memory.saveRunMemory?.(run);
  }

  private initializeRunState(
    run: AgentRunState,
    document: ContextDocument,
    prompt: ResolvedSystemPrompt,
  ): void {
    const state: ContextManagerRunState = {
      document: {...document, sections: [...document.sections]},
      prompt,
      contextBuilds: [],
    };
    this.runStates.set(run, state);
    run.context.contextBuilds = state.contextBuilds;
  }

  private getRunState(run: AgentRunState): ContextManagerRunState {
    const state = this.runStates.get(run);
    if (state) {
      return state;
    }

    const fallbackState: ContextManagerRunState = {
      document: {
        sections: [],
        transcript: run.messages,
        metadata: {runId: run.runId, iteration: run.iteration, stage: "agent"},
      },
      prompt: this.resolveSystemPrompt(run),
      contextBuilds: [],
    };
    this.runStates.set(run, fallbackState);
    run.context.contextBuilds = fallbackState.contextBuilds;
    return fallbackState;
  }

  private recordContextBuild(
    run: AgentRunState,
    state: ContextManagerRunState,
    diagnostics: BuildContextDiagnostics | undefined,
  ): void {
    state.contextBuilds.push({iteration: run.iteration, diagnostics});
    run.context.lastContextBuildDiagnostics = diagnostics;
    run.context.contextBuilds = state.contextBuilds;
  }

  private recordAndObserveContextBuild(
    run: AgentRunState,
    state: ContextManagerRunState,
    diagnostics: BuildContextDiagnostics,
  ): void {
    this.recordContextBuild(run, state, diagnostics);
    this.options.observer.contextBuilt(run, diagnostics.estimatedTotalInputTokens);
  }

  private resolveSystemPrompt(run: AgentRunState): ResolvedSystemPrompt {
    return this.systemPromptService.resolve({
      mode: run.input.mode ?? "edit",
      configInstructions: this.options.config.runtime.systemInstructions,
      runInstructions: run.input.systemInstructions ?? [],
    });
  }
}

/** Creates the default context manager. */
export function createContextManager(options: ContextManagerOptions): ContextManager {
  return new ContextManager(options);
}

type ContextManagerRunState = {
  document: ContextDocument;
  prompt: ResolvedSystemPrompt;
  contextBuilds: Array<{
    iteration: number;
    diagnostics?: BuildContextDiagnostics;
  }>;
};
