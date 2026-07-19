import type {LLMMessage} from "../../llm/types.js";
import {SystemPromptService, type ResolvedSystemPrompt} from "../prompt/index.js";
import {
  ContextBudgeter,
  ContextCollector,
  ContextCompressionPipeline,
  ContextTruncator,
  createDefaultTokenEstimator,
  PromptAssembler,
  RuleBasedContextCompressor,
  type TokenEstimator,
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
import {stringifyToolResult} from "../runtime-utils.js";
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

  /**
   * Context build core dependencies.
   */
  transcriptProjector?: TranscriptProjector;

  tokenEstimator?: TokenEstimator;

  budgeter?: ContextBudgeter;

  compressionPipeline?: ContextCompressionPipeline;

  truncator?: ContextTruncator;

  promptAssembler?: PromptAssembler;

  systemPromptService?: SystemPromptService;
};

/** Builds model context and owns transcript mutation for assistant/tool turns. */
export class ContextManager {
  private readonly collector: ContextCollector;
  private readonly transcriptProjector: TranscriptProjector;
  private readonly tokenEstimator: TokenEstimator;
  private readonly budgeter: ContextBudgeter;
  private readonly compressionPipeline: ContextCompressionPipeline;
  private readonly truncator: ContextTruncator;
  private readonly promptAssembler: PromptAssembler;
  private readonly systemPromptService: SystemPromptService;
  private readonly runStates = new WeakMap<AgentRunState, ContextManagerRunState>();

  /** Creates a context manager with static agent-level context providers. */
  constructor(private readonly options: ContextManagerOptions) {
    this.collector = new ContextCollector({
      memory: options.memory,
      contextProviders: options.contextProviders,
    });

    this.tokenEstimator = options.tokenEstimator ?? createDefaultTokenEstimator();

    this.transcriptProjector = options.transcriptProjector ?? new TranscriptProjector();

    this.budgeter =
      options.budgeter ??
      new ContextBudgeter({
        tokenEstimator: this.tokenEstimator,
      });

    this.compressionPipeline =
      options.compressionPipeline ??
      new ContextCompressionPipeline({
        compressor: new RuleBasedContextCompressor({
          tokenEstimator: this.tokenEstimator,
        }),

        tokenEstimator: this.tokenEstimator,
      });

    this.truncator =
      options.truncator ??
      new ContextTruncator({
        tokenEstimator: this.tokenEstimator,
      });

    this.promptAssembler = options.promptAssembler ?? new PromptAssembler();

    this.systemPromptService = options.systemPromptService ?? new SystemPromptService();
  }

  /** Initializes static context sources and the mutable transcript for a run. */
  async prepare(run: AgentRunState): Promise<void> {
    const prompt = this.systemPromptService.resolve({
      mode: run.input.mode ?? "edit",
      configInstructions: this.options.config.runtime.systemInstructions,
      runInstructions: run.input.systemInstructions ?? [],
    });
    const document = await this.collector.collect(run);
    this.initializeRunState(run, document, prompt);
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
      state.prompt,
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
      systemPromptVersion: state.prompt.version,
      systemPromptTokens: this.tokenEstimator.countText(systemPrompt),
      systemPromptSectionTokens: state.prompt.sections.map((section) => ({
        id: section.id,
        tokens: this.tokenEstimator.countText(`# ${section.title}\n${section.content}`),
      })),
    };

    this.recordContextBuild(run, state, diagnostics);
    this.options.observer.contextBuilt(run, diagnostics.systemPromptTokens);

    return this.promptAssembler.assemble(
      state.prompt,
      projection,
      truncation.contextText,
    );
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
      prompt: this.systemPromptService.resolve({
        mode: run.input.mode ?? "edit",
        configInstructions: this.options.config.runtime.systemInstructions,
        runInstructions: run.input.systemInstructions ?? [],
      }),
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
  prompt: ResolvedSystemPrompt;
  contextBuilds: Array<{
    iteration: number;
    diagnostics?: BuildContextDiagnostics;
  }>;
  lastBuildDiagnostics?: BuildContextDiagnostics;
};
