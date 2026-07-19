import type {LLMMessage} from "../../llm/types.js";
import {
  ContextBudgeter,
  ContextCollector,
  ContextCompressionPipeline,
  ContextTruncator,
  createDefaultTokenEstimator,
  PromptAssembler,
  RuleBasedContextCompressor,
  TranscriptProjector,
  type BuildContextDiagnostics,
  type ContextDocument,
} from "../../context/index.js";
import type {
  AgentModelResponse,
  AgentRuntimeConfig,
  AgentToolResult,
  AgentContextProvider,
} from "../types.js";
import {
  CLI_MARKDOWN_OUTPUT_INSTRUCTIONS,
  DEFAULT_SYSTEM_PROMPT,
  stringifyToolResult,
} from "../runtime-utils.js";
import type {AgentMemory} from "./memory.js";
import type {AgentObserver} from "./observer.js";
import type {AgentRunState} from "./run-state.js";
import type {WorkspaceService} from "./workspace-service.js";

/** Dependencies used to build and maintain the model transcript. */
export type ContextManagerOptions = {
  /** Normalized agent config for prompt and token-limit settings. */
  config: AgentRuntimeConfig;
  /** Workspace service whose profile is injected into runtime context. */
  workspace: WorkspaceService;
  /** Memory implementation used to load contextual knowledge. */
  memory: AgentMemory;
  /** Observer used to emit context lifecycle events. */
  observer: AgentObserver;
  /** Agent-level context providers invoked for every run. */
  contextProviders?: readonly AgentContextProvider[];
};

/** Builds model context and owns transcript mutation for assistant/tool turns. */
export class ContextManager {
  private readonly collector: ContextCollector;
  private readonly transcriptProjector = new TranscriptProjector();
  private readonly tokenEstimator = createDefaultTokenEstimator();
  private readonly budgeter = new ContextBudgeter({
    tokenEstimator: this.tokenEstimator,
  });
  private readonly compressionPipeline = new ContextCompressionPipeline({
    compressor: new RuleBasedContextCompressor({
      tokenEstimator: this.tokenEstimator,
    }),
    tokenEstimator: this.tokenEstimator,
  });
  private readonly truncator = new ContextTruncator({
    tokenEstimator: this.tokenEstimator,
  });
  private readonly promptAssembler = new PromptAssembler();
  private readonly runStates = new WeakMap<AgentRunState, ContextManagerRunState>();

  /** Creates a context manager with static agent-level context providers. */
  constructor(private readonly options: ContextManagerOptions) {
    this.collector = new ContextCollector({
      memory: options.memory,
      contextProviders: options.contextProviders,
    });
  }

  /** Initializes static context sources and the mutable transcript for a run. */
  async prepare(run: AgentRunState): Promise<void> {
    const document = await this.collector.collect(run, {
      systemPrompt:
        run.input.systemPrompt ??
        this.options.config.runtime.systemPrompt ??
        DEFAULT_SYSTEM_PROMPT,
      outputInstructions: CLI_MARKDOWN_OUTPUT_INSTRUCTIONS,
    });
    this.initializeRunState(run, document);
    run.messages.push(...(run.input.messages ?? []));
    run.messages.push({role: "user", content: run.input.prompt});
  }

  /** Builds a fresh model transcript with dynamic runtime context. */
  buildModelRequest(run: AgentRunState): readonly LLMMessage[] {
    const state = this.getRunState(run);
    const document: ContextDocument = {
      ...state.document,
      transcript: run.messages,
      metadata: {...state.document.metadata, iteration: run.iteration},
    };
    const projection = this.transcriptProjector.project(document.transcript);
    const budgeted = this.budgeter.budget(
      document,
      projection,
      this.options.config.runtime.tokensLimit,
    );
    const compression = this.compressionPipeline.process(budgeted);
    const truncation = this.truncator.truncate(compression.sections, budgeted.budget);
    const systemPrompt = this.promptAssembler.assembleSystemPrompt(
      document,
      truncation.contextText,
    );
    const diagnostics: BuildContextDiagnostics = {
      budget: budgeted.budget,
      estimatedContextChars: compression.estimatedContextChars,
      estimatedContextTokens: compression.estimatedContextTokens,
      compressionThresholdRatio: compression.thresholdRatio,
      compressionTriggered: compression.triggered,
      compressionLimitTokens: compression.compressionLimitTokens,
      compressionResults: compression.results,
      contextTextTokens: this.tokenEstimator.countText(truncation.contextText),
      systemPromptTokens: this.tokenEstimator.countText(systemPrompt),
    };

    this.recordContextBuild(run, state, diagnostics);
    this.options.observer.contextBuilt(run, diagnostics.systemPromptTokens);

    return this.promptAssembler.assemble(document, projection, truncation.contextText);
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

  /** Appends a repair prompt as a user message before a repair model call. */
  appendRepairPrompt(run: AgentRunState, content: string): void {
    run.messages.push({role: "user", content});
  }

  /** Gives the memory implementation a chance to persist run knowledge. */
  async save(run: AgentRunState): Promise<void> {
    await this.options.memory.saveRunMemory?.(run);
  }

  private initializeRunState(run: AgentRunState, document: ContextDocument): void {
    const state: ContextManagerRunState = {
      document: {...document, sections: [...document.sections]},
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
        systemPrompt:
          run.input.systemPrompt ??
          this.options.config.runtime.systemPrompt ??
          DEFAULT_SYSTEM_PROMPT,
        outputInstructions: CLI_MARKDOWN_OUTPUT_INSTRUCTIONS,
        sections: [],
        transcript: run.messages,
        metadata: {runId: run.runId, iteration: run.iteration, stage: "agent"},
      },
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
    state.lastBuildDiagnostics = diagnostics;
    state.contextBuilds.push({iteration: run.iteration, diagnostics});
    run.context.lastContextBuildDiagnostics = diagnostics;
    run.context.contextBuilds = state.contextBuilds;
  }
}

/** Creates the default context manager. */
export function createContextManager(options: ContextManagerOptions): ContextManager {
  return new ContextManager(options);
}

type ContextManagerRunState = {
  document: ContextDocument;
  contextBuilds: Array<{
    iteration: number;
    diagnostics?: BuildContextDiagnostics;
  }>;
  lastBuildDiagnostics?: BuildContextDiagnostics;
};
