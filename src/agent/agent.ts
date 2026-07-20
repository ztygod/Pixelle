import {loadAgentConfig, type AgentConfig} from "../config/index.js";
import {EventBus, type PixelleEvent} from "../events/index.js";
import {createDefaultContextPipeline} from "../context/index.js";
import {AgentMiddlewarePipeline} from "./middleware.js";
import {
  AgentRunState,
  createAgentObserver,
  createChangeRuntime,
  createContextManager,
  createModelRuntime,
  createNoopMemory,
  createRuntimePolicy,
  createToolRuntime,
  createVerificationPipeline,
  createWorkspaceService,
  registerToolRuntimeRun,
  unregisterToolRuntimeRun,
  type AgentMemory,
  type AgentObserver,
  type ChangeRuntime,
  type ContextManager,
  type ModelRuntime,
  type RuntimePolicy,
  type ToolRuntime,
  type VerificationPipeline,
  type WorkspaceService,
} from "./runtime/index.js";
import {DEFAULT_MAX_ITERATIONS, normalizeConfig} from "./runtime-utils.js";
import type {
  AgentMiddleware,
  AgentOptions,
  AgentRunInput,
  AgentRunResult,
  AgentRuntimeConfig,
  CreateAgentRuntimeFromConfigOptions,
  RunInternalOptions,
  StreamQueueItem,
} from "./types.js";

/**
 * Thin orchestrator for the modular coding-agent runtime.
 *
 * The Agent coordinates model calls, tool execution, context management,
 * workspace preparation, change tracking, verification, events, and middleware.
 * Concrete runtime behavior is delegated to dedicated runtime modules.
 */
export class Agent {
  // Normalized runtime configuration for this agent instance.
  readonly config: AgentRuntimeConfig;

  // Shared event bus used to publish Pixelle runtime events.
  readonly eventBus: EventBus<PixelleEvent>;

  // Handles model requests, streaming, retries, and response normalization.
  private readonly model: ModelRuntime;

  // Manages tool schemas, tool execution, permissions, and tool results.
  private readonly tools: ToolRuntime;

  // Builds and updates the model-visible context for each run.
  private readonly context: ContextManager;

  // Prepares and inspects the current workspace.
  private readonly workspace: WorkspaceService;

  // Loads and stores agent, project, or user memory.
  private readonly memory: AgentMemory;

  // Centralizes runtime permissions, command policy, and safety decisions.
  private readonly policy: RuntimePolicy;

  // Tracks file changes, checkpoints, diffs, and rollback behavior.
  private readonly changes: ChangeRuntime;

  // Runs verification and repair flows after agent execution.
  private readonly verification: VerificationPipeline;

  // Publishes lifecycle events for UI, streaming, and observers.
  private readonly observer: AgentObserver;

  // Mutable list of middleware registered on this agent instance.
  private readonly middleware: AgentMiddleware[];

  // Executes middleware hooks around runs, model calls, and tool calls.
  private readonly middlewarePipeline: AgentMiddlewarePipeline;

  /**
   * Creates an agent runtime from explicit dependencies and runtime configuration.
   *
   * Missing dependencies are initialized with the default modular runtime
   * implementations, while injected dependencies can override any subsystem.
   */
  constructor(options: AgentOptions) {
    this.config = normalizeConfig(options.config);
    this.eventBus = options.eventBus ?? new EventBus<PixelleEvent>();
    this.middleware = [...(options.middleware ?? [])];
    this.middlewarePipeline = new AgentMiddlewarePipeline(this.middleware);

    this.observer = options.observer ?? createAgentObserver({eventBus: this.eventBus});
    this.policy =
      options.policy ??
      createRuntimePolicy({
        config: this.config.permissions,
        permissions: options.permissions,
        commandPolicy: options.commandPolicy,
      });
    this.workspace =
      options.workspace ??
      createWorkspaceService({
        workspaceRoot: this.config.runtime.workspaceDir,
        scanner: options.workspaceScanner,
      });
    this.memory = options.memory ?? createNoopMemory();
    this.changes =
      options.changes ??
      createChangeRuntime({
        config: this.config,
        workspace: this.workspace,
        policy: this.policy,
        observer: this.observer,
        checkpointStore: options.checkpointStore,
      });
    this.tools =
      options.tools ??
      createToolRuntime({
        config: this.config,
        workspace: this.workspace,
        policy: this.policy,
        changes: this.changes,
        observer: this.observer,
        middleware: this.middlewarePipeline,
        toolRegistry: options.toolRegistry,
        toolRunner: options.toolRunner,
      });
    this.model =
      options.model ??
      createModelRuntime({
        config: this.config,
        llm: options.llm,
        middleware: this.middlewarePipeline,
        observer: this.observer,
      });
    this.context =
      options.context ??
      createContextManager({
        config: this.config,
        memory: this.memory,
        observer: this.observer,
        contextProviders: options.contextProviders,
        pipeline: createDefaultContextPipeline({
          transcriptSummarizer: options.transcriptSummarizer,
          llm: options.llm,
          llmConfig: this.config.llm,
        }),
      });
    this.verification =
      options.verification ??
      createVerificationPipeline({
        config: this.config,
        workspace: this.workspace,
        policy: this.policy,
        tools: this.tools,
        model: this.model,
        context: this.context,
        changes: this.changes,
        observer: this.observer,
        verifier: options.verifier,
      });
  }

  /**
   * Registers middleware and returns a disposer that removes it.
   */
  use(middleware: AgentMiddleware): () => void {
    this.middleware.push(middleware);

    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index >= 0) {
        this.middleware.splice(index, 1);
      }
    };
  }

  /**
   * Runs the agent to completion and returns the final result.
   */
  run(input: AgentRunInput): Promise<AgentRunResult> {
    return this.runInternal(input, {});
  }

  /**
   * Runs the agent and yields lifecycle events as they are produced.
   */
  async *stream(input: AgentRunInput): AsyncIterable<PixelleEvent> {
    const queue: StreamQueueItem[] = [];
    const waiters: Array<() => void> = [];

    const push = (item: StreamQueueItem): void => {
      queue.push(item);
      waiters.splice(0).forEach((resolve) => resolve());
    };

    const runPromise = this.runInternal(input, {
      eventSink: (event) => push({type: "event", event}),
    })
      .then(() => push({type: "done"}))
      .catch((error: unknown) => push({type: "error", error}));

    try {
      while (true) {
        if (!queue.length) {
          await new Promise<void>((resolve) => waiters.push(resolve));
        }

        const item = queue.shift();
        if (!item) {
          continue;
        }

        if (item.type === "event") {
          yield item.event;
          continue;
        }

        if (item.type === "error") {
          throw item.error;
        }

        break;
      }
    } finally {
      await runPromise;
    }
  }

  /**
   * Executes the full agent workflow for a single run.
   *
   * The workflow prepares runtime state, builds model context, executes
   * model/tool iterations, verifies the result, optionally rolls back changes,
   * and returns the final run result.
   */
  private async runInternal(
    input: AgentRunInput,
    options: RunInternalOptions,
  ): Promise<AgentRunResult> {
    const run = new AgentRunState({
      agent: this,
      config: this.config,
      input,
      internalOptions: options,
    });
    const maxIterations =
      input.maxIterations ?? this.config.runtime.maxIterations ?? DEFAULT_MAX_ITERATIONS;

    registerToolRuntimeRun(run);

    try {
      await this.executeRun(run, maxIterations);
    } catch (error) {
      run.fail(error);
    }

    return this.finalizeRun(run);
  }

  /** Executes user work without owning terminal cleanup or result publication. */
  private async executeRun(run: AgentRunState, maxIterations: number): Promise<void> {
    this.observer.runStarted(run);
    await this.middlewarePipeline.beforeAgentRun(run.context);

    run.task.status = "planning";
    await this.workspace.prepare(run);
    this.changes.prepare(run);
    await this.context.prepare(run);

    run.task.status = "executing";
    while (run.canContinue(maxIterations)) {
      run.nextIteration();
      this.observer.assistantStage(run);

      const response = await this.model.generate(
        await this.context.buildModelRequest(run, this.tools.schemas()),
        run,
      );
      this.context.appendAssistantResponse(run, response);

      if (!response.toolCalls.length) {
        run.complete(response.content);
        break;
      }

      const toolResults = await this.tools.execute(
        run,
        response.toolCalls.map((toolCall) => ({
          ...toolCall,
          iteration: run.iteration,
        })),
      );
      this.context.appendToolResults(run, toolResults);
      await this.changes.checkpoint(run);
    }

    if (run.input.signal?.aborted) {
      run.stopReason = "aborted";
    } else if (run.iteration >= maxIterations && run.stopReason === "completed") {
      run.stopReason = "max_iterations";
    }

    if (run.stopReason !== "aborted") {
      await this.verification.verifyAndRepair(run, maxIterations);
    }
  }

  /** Runs every terminal action once, while preserving the primary run outcome. */
  private async finalizeRun(run: AgentRunState): Promise<AgentRunResult> {
    let result: AgentRunResult | undefined;

    try {
      if (this.shouldRollback(run)) {
        try {
          run.finalization.rollback = await this.changes.rollback(run);
        } catch (error) {
          run.finalization.rollback = {
            status: "failed",
            restoredFiles: [],
            conflicts: [
              {path: "", message: error instanceof Error ? error.message : String(error)},
            ],
          };
          run.recordFinalizationIssue("rollback", error);
        }
      }

      this.finalizeTaskStatus(run);

      try {
        await this.context.save(run);
      } catch (error) {
        run.recordFinalizationIssue("memory", error);
      }

      try {
        result = await this.middlewarePipeline.afterAgentRun(run.toResult(), run.context);
      } catch (error) {
        run.recordFinalizationIssue("middleware", error);
      }

      this.observer.runTerminated(run);
    } finally {
      unregisterToolRuntimeRun(run);
      run.task.updatedAt = Date.now();
    }

    return result ?? run.toResult();
  }

  private shouldRollback(run: AgentRunState): boolean {
    return (
      run.stopReason !== "completed" &&
      (run.input.rollbackOnFailure ?? this.config.runtime.rollbackOnFailure)
    );
  }

  private finalizeTaskStatus(run: AgentRunState): void {
    if (run.stopReason === "completed") {
      run.task.status = "completed";
    } else if (run.stopReason === "aborted") {
      run.task.status = "cancelled";
    } else {
      run.task.status = "failed";
    }

    run.task.updatedAt = Date.now();
  }
}

/**
 * Alias kept for consumers that prefer the explicit CodingAgent name.
 */
export const CodingAgent = Agent;

/**
 * Creates an agent runtime from either full agent options or a loaded config.
 */
export function createAgentRuntime(options: AgentOptions): Agent;
export function createAgentRuntime(config: AgentConfig): Agent;
export function createAgentRuntime(input: AgentOptions | AgentConfig): Agent {
  if ("runtime" in input && "llm" in input) {
    return new Agent({config: input});
  }

  return new Agent(input as AgentOptions);
}

/**
 * Creates the product runtime by loading Pixelle config from pixelle.toml.
 */
export async function createAgentRuntimeFromConfig(
  options: CreateAgentRuntimeFromConfigOptions = {},
): Promise<Agent> {
  const {cwd, configFile, ...injections} = options;
  const config = await loadAgentConfig({cwd, configFile});

  return new Agent({
    ...injections,
    config,
  });
}
