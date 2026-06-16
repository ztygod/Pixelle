import {randomUUID} from "node:crypto";

import {loadAgentConfig, type AgentConfig} from "../config/index.js";
import {EventBus, type PixelleEvent} from "../events/index.js";
import {LLMClient, type BaseLLMClient} from "../llm/index.js";
import type {LLMMessage, LLMUsage} from "../llm/types.js";
import {
  ChangeTracker,
  createCommandPolicy,
  JsonCheckpointStore,
  JsonTraceStore,
  Verifier,
  WorkspaceScanner,
  type ChangeSet,
  type CommandPolicyLike,
  type TaskRun,
  type VerificationResult,
  type WorkspaceProfile,
} from "../runtime/index.js";
import {
  createDefaultToolRegistry,
  ToolRunner,
  type ToolRunnerEvent,
  type ToolRegistry,
  type ToolPermissions,
} from "../tool/index.js";
import {buildRuntimeContext, buildSystemPrompt} from "./context.js";
import {AgentMiddlewarePipeline} from "./middleware.js";
import {
  buildLLMTools,
  createEventMetadata,
  createToolContext,
  DEFAULT_MAX_ITERATIONS,
  emitAgentEvent,
  mergePermissions,
  mergeUsage,
  missingLLMClient,
  normalizeConfig,
  stringifyToolResult,
} from "./runtime-utils.js";
import {emitToolRunnerEventAsAgentEvent} from "./tool-runner-events.js";
import type {
  AgentContextProvider,
  AgentMiddleware,
  AgentModelResponse,
  AgentOptions,
  AgentRunContext,
  AgentRunInput,
  AgentRunResult,
  AgentRuntimeConfig,
  AgentStopReason,
  AgentToolCall,
  AgentToolResult,
  CreateAgentRuntimeFromConfigOptions,
  RunInternalOptions,
  StreamQueueItem,
} from "./types.js";

/** Orchestrates model calls, tool execution, context injection, events, and middleware. */
export class Agent {
  readonly config: AgentRuntimeConfig;
  readonly eventBus: EventBus<PixelleEvent>;

  private readonly llm: BaseLLMClient;
  private readonly toolRegistry: ToolRegistry;
  private readonly toolRunner: ToolRunner;
  private readonly usesToolRunnerEventAdapter: boolean;
  private readonly middleware: AgentMiddleware[];
  private readonly middlewarePipeline: AgentMiddlewarePipeline;
  private readonly contextProviders: AgentContextProvider[];
  private readonly permissions: ToolPermissions;
  private readonly traceStore?: AgentOptions["traceStore"];
  private readonly checkpointStore?: AgentOptions["checkpointStore"];
  private readonly workspaceScanner: WorkspaceScanner;
  private readonly verifier: Verifier;
  private readonly commandPolicy: CommandPolicyLike;
  private readonly runOptionsByTraceId = new Map<string, RunInternalOptions>();
  private readonly pendingToolRunnerTerminalEvents = new Map<
    string,
    Exclude<ToolRunnerEvent, {type: "runner.tool.started"}>
  >();

  /** Creates an agent runtime from explicit dependencies and runtime configuration. */
  constructor(options: AgentOptions) {
    this.config = normalizeConfig(options.config);
    this.llm =
      options.llm ??
      (this.config.llm ? new LLMClient(this.config.llm) : missingLLMClient());
    this.toolRegistry = options.toolRegistry ?? createDefaultToolRegistry();
    this.eventBus = options.eventBus ?? new EventBus<PixelleEvent>();
    this.usesToolRunnerEventAdapter = !options.toolRunner;
    this.toolRunner =
      options.toolRunner ??
      new ToolRunner(this.toolRegistry, {
        onEvent: (event) => {
          this.emitToolRunnerEvent(event);
        },
      });
    this.middleware = [...(options.middleware ?? [])];
    this.middlewarePipeline = new AgentMiddlewarePipeline(this.middleware);
    this.contextProviders = [...(options.contextProviders ?? [])];
    this.permissions = mergePermissions(this.config.permissions, options.permissions);
    this.traceStore = options.traceStore;
    this.checkpointStore = options.checkpointStore;
    this.workspaceScanner = options.workspaceScanner ?? new WorkspaceScanner();
    this.commandPolicy = options.commandPolicy ?? createCommandPolicy();
    this.verifier = options.verifier ?? new Verifier(this.commandPolicy);
  }

  /** Registers middleware and returns a disposer for removing it. */
  use(middleware: AgentMiddleware): () => void {
    this.middleware.push(middleware);

    return () => {
      const index = this.middleware.indexOf(middleware);
      if (index >= 0) {
        this.middleware.splice(index, 1);
      }
    };
  }

  /** Runs the agent to completion and returns the final transcript and metadata. */
  run(input: AgentRunInput): Promise<AgentRunResult> {
    return this.runInternal(input, {});
  }

  /** Streams lifecycle events while the same underlying run executes. */
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

  /** Runs the full agent workflow, including model/tool loop, verification, and tracing. */
  private async runInternal(
    input: AgentRunInput,
    options: RunInternalOptions,
  ): Promise<AgentRunResult> {
    const runId = options.runId ?? randomUUID();
    const sessionId = options.sessionId ?? runId;
    const traceId = options.traceId ?? randomUUID();
    const maxIterations =
      input.maxIterations ?? this.config.runtime.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const context = this.createRunContext({
      input,
      runId,
      sessionId,
      traceId,
    });
    const messages: LLMMessage[] = [];
    const toolResults: AgentToolResult[] = [];
    const changes: ChangeSet[] = [];
    const verification: VerificationResult[] = [];
    const task = createTaskRun(runId);
    const traceStore =
      this.config.trace?.enabled === false
        ? this.traceStore
        : (this.traceStore ??
          new JsonTraceStore(
            this.config.trace?.directory ?? this.config.runtime.workspaceDir,
            runId,
          ));
    const checkpointStore =
      this.checkpointStore ??
      new JsonCheckpointStore(
        this.config.trace?.directory ?? this.config.runtime.workspaceDir,
        runId,
      );
    const changeTracker = new ChangeTracker({
      runId,
      workspaceRoot: this.config.runtime.workspaceDir,
      checkpointStore,
    });
    let checkpointPath: string | undefined;
    let workspaceProfile: WorkspaceProfile | undefined;
    let content = "";
    let stopReason: AgentStopReason = "completed";
    let usage: LLMUsage | undefined;

    this.runOptionsByTraceId.set(traceId, options);

    try {
      context.traceStore = traceStore;
      context.fileWriter = changeTracker;
      await traceStore?.start({
        runId,
        sessionId,
        traceId,
        prompt: input.prompt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        events: [],
        modelCalls: [],
        toolCalls: [],
        changeSets: changes,
        verificationResults: verification,
      });
      this.emitRunStarted(input, sessionId, traceId, options);
      this.emitTaskStarted(task, input, sessionId, traceId, options);
      await this.middlewarePipeline.beforeAgentRun(context);

      workspaceProfile = await this.workspaceScanner.scan(
        this.config.runtime.workspaceDir,
        input.signal,
      );
      context.workspaceProfile = workspaceProfile;
      context.input.context = [
        ...(context.input.context ?? []),
        {
          title: "Workspace Profile",
          priority: 100,
          content: JSON.stringify(workspaceProfile, null, 2),
        },
      ];
      await traceStore?.update((trace) => {
        trace.workspaceProfile = workspaceProfile;
      });

      await this.addInitialMessages(messages, context, options);
      const tools = buildLLMTools(this.toolRegistry);

      // The core loop alternates model responses and tool results until the
      // model stops requesting tools or a runtime guard stops the run.
      for (let iteration = 1; iteration <= maxIterations; iteration += 1) {
        if (input.signal?.aborted) {
          stopReason = "aborted";
          break;
        }

        context.iteration = iteration;
        this.emitAssistantStage(context, iteration, options);

        const response = await this.generateModelResponse({
          context,
          iteration,
          messages,
          tools,
          options,
        });
        usage = mergeUsage(usage, response.usage);
        content = response.content || content;

        messages.push({
          role: "assistant",
          content: response.content,
          toolCalls: response.toolCalls,
        });

        if (!response.toolCalls.length) {
          stopReason = "completed";
          break;
        }

        for (const toolCall of response.toolCalls) {
          const toolResult = await this.runTool(
            {...toolCall, iteration},
            context,
            options,
          );
          toolResults.push(toolResult);
          messages.push({
            role: "tool",
            toolCallId: toolResult.call.id,
            name: toolResult.call.name,
            content: stringifyToolResult(toolResult.result),
          });
        }

        const checkpoint = await changeTracker.checkpoint();
        if (checkpoint.changeSet) {
          changes.push(checkpoint.changeSet);
          checkpointPath = checkpoint.path ?? checkpointPath;
          this.emitChangeSetApplied(
            checkpoint.changeSet,
            checkpoint.path,
            context,
            options,
          );
          await traceStore?.update((trace) => {
            trace.changeSets = changes;
          });
        }

        if (iteration === maxIterations) {
          stopReason = "max_iterations";
        }
      }

      const verificationEnabled =
        input.verification?.enabled ??
        this.config.verification?.enabled ??
        input.mode !== "ask";
      if (verificationEnabled && workspaceProfile) {
        task.status = "verifying";
        const selectedCommands = this.verifier.selectCommands(
          workspaceProfile,
          input.verification?.commands?.length
            ? input.verification.commands
            : this.config.verification?.commands,
        );
        this.emitVerificationStarted(
          selectedCommands,
          input,
          sessionId,
          traceId,
          options,
        );
        verification.push(
          ...(await this.verifier.verify(
            this.config.runtime.workspaceDir,
            workspaceProfile,
            {
              commands: input.verification?.commands?.length
                ? input.verification.commands
                : this.config.verification?.commands,
              signal: input.signal,
            },
          )),
        );
        this.emitVerificationCompleted(verification, input, sessionId, traceId, options);
        await traceStore?.update((trace) => {
          trace.verificationResults = verification;
        });

        let failedVerification = verification.find((result) => !result.passed);
        const maxRepairAttempts =
          input.maxRepairAttempts ?? this.config.runtime.maxRepairAttempts;
        for (
          let repairAttempt = 1;
          failedVerification && repairAttempt <= maxRepairAttempts;
          repairAttempt += 1
        ) {
          if (context.iteration >= maxIterations || input.signal?.aborted) {
            break;
          }

          task.status = "repairing";
          messages.push({
            role: "user",
            content: buildRepairPrompt(failedVerification, repairAttempt),
          });

          context.iteration += 1;
          this.emitAssistantStage(context, context.iteration, options);
          const repairResponse = await this.generateModelResponse({
            context,
            iteration: context.iteration,
            messages,
            tools,
            options,
          });
          usage = mergeUsage(usage, repairResponse.usage);
          content = repairResponse.content || content;
          messages.push({
            role: "assistant",
            content: repairResponse.content,
            toolCalls: repairResponse.toolCalls,
          });

          for (const toolCall of repairResponse.toolCalls) {
            const toolResult = await this.runTool(
              {...toolCall, iteration: context.iteration},
              context,
              options,
            );
            toolResults.push(toolResult);
            messages.push({
              role: "tool",
              toolCallId: toolResult.call.id,
              name: toolResult.call.name,
              content: stringifyToolResult(toolResult.result),
            });
          }

          const checkpoint = await changeTracker.checkpoint();
          if (checkpoint.changeSet) {
            changes.push(checkpoint.changeSet);
            checkpointPath = checkpoint.path ?? checkpointPath;
            this.emitChangeSetApplied(
              checkpoint.changeSet,
              checkpoint.path,
              context,
              options,
            );
          }

          const repairVerification = await this.verifier.verify(
            this.config.runtime.workspaceDir,
            workspaceProfile,
            {
              commands: input.verification?.commands?.length
                ? input.verification.commands
                : this.config.verification?.commands,
              signal: input.signal,
            },
          );
          verification.push(...repairVerification);
          this.emitVerificationCompleted(
            repairVerification,
            input,
            sessionId,
            traceId,
            options,
          );
          await traceStore?.update((trace) => {
            trace.changeSets = changes;
            trace.verificationResults = verification;
          });
          failedVerification = repairVerification.find((result) => !result.passed);
        }

        if (failedVerification) {
          stopReason = "error";
          content =
            `${content}\n\nVerification failed: ${failedVerification.command}`.trim();
        } else {
          stopReason = "completed";
        }
      }

      if (
        stopReason !== "completed" &&
        (input.rollbackOnFailure ?? this.config.runtime.rollbackOnFailure) &&
        changes.length > 0
      ) {
        task.status = "rolled_back";
        for (const changeSet of [...changes].reverse()) {
          this.emitChangeSetRollbackStarted(changeSet, context, options);
          await changeTracker.rollback(changeSet);
          this.emitChangeSetRollbackCompleted(changeSet, context, options);
        }
      } else {
        task.status = stopReason === "completed" ? "completed" : "failed";
      }
      task.updatedAt = Date.now();

      const result = await this.middlewarePipeline.afterAgentRun(
        {
          runId,
          sessionId,
          traceId,
          content,
          messages,
          toolResults,
          usage,
          iterations: context.iteration,
          stopReason,
          task,
          changes,
          verification,
          workspaceProfile,
          tracePath: traceStore?.tracePath,
          checkpointPath,
        },
        context,
      );

      this.emitRunStopped(input, runId, sessionId, traceId, stopReason, options);
      await traceStore?.update((trace) => {
        const {messages: resultMessages, ...serializableResult} = result;
        trace.events = this.eventsForTrace(traceId);
        trace.finalResult = {
          ...serializableResult,
          messageCount: resultMessages.length,
        };
      });
      this.emitTracePersisted(traceStore?.tracePath, input, sessionId, traceId, options);
      return result;
    } catch (error) {
      stopReason = input.signal?.aborted ? "aborted" : "error";
      task.status = "failed";
      task.updatedAt = Date.now();
      this.emitRunFailed(input, sessionId, traceId, stopReason, error, options);
      await traceStore?.update((trace) => {
        trace.events = this.eventsForTrace(traceId);
        trace.error = error instanceof Error ? error.message : "Agent run failed.";
      });

      return {
        runId,
        sessionId,
        traceId,
        content,
        messages,
        toolResults,
        usage,
        iterations: context.iteration,
        stopReason,
        task,
        changes,
        verification,
        workspaceProfile,
        tracePath: traceStore?.tracePath,
        checkpointPath,
        error,
      };
    } finally {
      this.runOptionsByTraceId.delete(traceId);
      this.deletePendingToolRunnerEvents(traceId);
    }
  }

  /** Creates the mutable per-run context passed to middleware and context providers. */
  private createRunContext(input: {
    input: AgentRunInput;
    runId: string;
    sessionId: string;
    traceId: string;
  }): AgentRunContext {
    return {
      agent: this,
      config: this.config,
      input: input.input,
      iteration: 0,
      runId: input.runId,
      sessionId: input.sessionId,
      signal: input.input.signal,
      traceId: input.traceId,
    };
  }

  /** Builds and appends the initial system, historical, and user messages. */
  private async addInitialMessages(
    messages: LLMMessage[],
    context: AgentRunContext,
    options: RunInternalOptions,
  ): Promise<void> {
    const contextText = await buildRuntimeContext({
      context,
      contextProviders: this.contextProviders,
      eventBus: this.eventBus,
      options,
    });
    const systemPrompt = buildSystemPrompt(context, contextText);

    messages.push({role: "system", content: systemPrompt});
    messages.push(...(context.input.messages ?? []));
    messages.push({role: "user", content: context.input.prompt});
  }

  /** Runs model middleware, calls the LLM, records trace data, and returns model output. */
  private async generateModelResponse(input: {
    context: AgentRunContext;
    iteration: number;
    messages: LLMMessage[];
    tools: ReturnType<typeof buildLLMTools>;
    options: RunInternalOptions;
  }): Promise<AgentModelResponse> {
    const request = await this.middlewarePipeline.beforeModel(
      {
        messages: input.messages,
        tools: input.tools,
        timeoutMs: this.config.llm?.timeoutMs,
        maxRetries: this.config.llm?.maxRetries,
        iteration: input.iteration,
        runId: input.context.runId,
      },
      input.context,
    );
    const rawResponse = await this.generateStreamingModelResponse(
      request,
      input.context,
      input.options,
    );
    await input.context.traceStore?.update((trace) => {
      trace.modelCalls.push({
        request,
        response: {
          ...rawResponse,
          iteration: input.iteration,
          runId: input.context.runId,
        },
        createdAt: Date.now(),
      });
    });

    return this.middlewarePipeline.afterModel(
      {
        ...rawResponse,
        iteration: input.iteration,
        runId: input.context.runId,
      },
      input.context,
    );
  }

  /** Streams model output when supported and falls back to generate() when needed. */
  private async generateStreamingModelResponse(
    request: Parameters<BaseLLMClient["stream"]>[0],
    context: AgentRunContext,
    options: RunInternalOptions,
  ): Promise<AgentModelResponse> {
    let streamedContent = "";
    let emittedContent = false;
    let finalResponse: AgentModelResponse | undefined;

    try {
      for await (const chunk of this.llm.stream(request)) {
        if (chunk.type === "content_delta") {
          streamedContent += chunk.content;
          emittedContent = true;
          emitAgentEvent(
            this.eventBus,
            {
              type: "conversation.assistant_delta",
              messageId: context.runId,
              delta: chunk.content,
              stage: "thinking",
              metadata: createEventMetadata(
                context.input,
                context.sessionId,
                context.traceId,
              ),
            },
            options,
          );
          continue;
        }

        if (chunk.type === "done") {
          finalResponse = {
            ...chunk.response,
            content: chunk.response.content || streamedContent,
            iteration: context.iteration,
            runId: context.runId,
          };
        }
      }
    } catch (error) {
      if (emittedContent) {
        throw error;
      }

      const response = await this.llm.generate(request);
      return {
        ...response,
        iteration: context.iteration,
        runId: context.runId,
      };
    }

    if (!finalResponse) {
      const response = await this.llm.generate(request);
      return {
        ...response,
        iteration: context.iteration,
        runId: context.runId,
      };
    }

    return finalResponse;
  }

  /** Executes one model-requested tool call through middleware and ToolRunner. */
  private async runTool(
    call: AgentToolCall,
    context: AgentRunContext,
    options: RunInternalOptions,
  ): Promise<AgentToolResult> {
    const toolCall = await this.middlewarePipeline.beforeTool(call, context);
    const metadata = createEventMetadata(
      context.input,
      context.sessionId,
      context.traceId,
    );

    if (!this.usesToolRunnerEventAdapter) {
      emitAgentEvent(
        this.eventBus,
        {
          type: "tool.call_started",
          id: toolCall.id,
          name: toolCall.name,
          input: toolCall.arguments,
          status: "running",
          metadata,
        },
        options,
      );
    }

    // ToolRunner owns schema validation and tool-level error normalization.
    const result = await this.toolRunner.run(
      toolCall.name,
      toolCall.arguments,
      createToolContext({
        workspaceRoot: this.config.runtime.workspaceDir,
        signal: context.input.signal,
        basePermissions: this.permissions,
        runPermissions: context.input.permissions,
        fileWriter: context.fileWriter,
        workspaceProfile: context.workspaceProfile,
        commandPolicy: this.commandPolicy,
      }),
      {
        callId: toolCall.id,
        metadata,
      },
    );
    const toolResult = await this.middlewarePipeline.afterTool(
      {call: toolCall, result},
      context,
    );
    await context.traceStore?.update((trace) => {
      trace.toolCalls.push(toolResult);
    });

    if (this.usesToolRunnerEventAdapter) {
      this.emitFinalToolRunnerEvent(toolCall.id, metadata, toolResult.result);
      return toolResult;
    }

    if (toolResult.result.ok) {
      emitAgentEvent(
        this.eventBus,
        {
          type: "tool.call_completed",
          id: toolCall.id,
          name: toolCall.name,
          output: toolResult.result.data,
          summary: toolResult.result.message,
          metadata,
        },
        options,
      );
    } else {
      emitAgentEvent(
        this.eventBus,
        {
          type: "tool.call_failed",
          id: toolCall.id,
          name: toolCall.name,
          error: toolResult.result.message,
          code: toolResult.result.code,
          data: toolResult.result.data,
          metadata,
        },
        options,
      );
    }

    return toolResult;
  }

  /** Handles ToolRunner events for the default runner without duplicating Agent events. */
  private emitToolRunnerEvent(event: ToolRunnerEvent): void {
    const traceId =
      typeof event.metadata?.traceId === "string" ? event.metadata.traceId : undefined;
    if (event.type !== "runner.tool.started") {
      if (traceId) {
        this.pendingToolRunnerTerminalEvents.set(
          this.toolRunnerEventKey(traceId, event.callId),
          event,
        );
        return;
      }
    }

    const options = traceId ? this.runOptionsByTraceId.get(traceId) : undefined;

    emitToolRunnerEventAsAgentEvent({
      eventBus: this.eventBus,
      event,
      options: options ?? {},
    });
  }

  /** Emits the final Agent tool event after afterTool middleware has finalized the result. */
  private emitFinalToolRunnerEvent(
    callId: string,
    metadata: Record<string, unknown>,
    result: AgentToolResult["result"],
  ): void {
    const traceId = typeof metadata.traceId === "string" ? metadata.traceId : undefined;
    const terminalEvent = traceId
      ? this.pendingToolRunnerTerminalEvents.get(this.toolRunnerEventKey(traceId, callId))
      : undefined;
    const options = traceId ? this.runOptionsByTraceId.get(traceId) : undefined;

    if (traceId) {
      this.pendingToolRunnerTerminalEvents.delete(
        this.toolRunnerEventKey(traceId, callId),
      );
    }

    if (!terminalEvent) {
      return;
    }

    emitToolRunnerEventAsAgentEvent({
      eventBus: this.eventBus,
      event: this.withToolRunnerEventResult(terminalEvent, result),
      options: options ?? {},
    });
  }

  /** Rebuilds a terminal runner event using the Agent's final post-middleware result. */
  private withToolRunnerEventResult(
    event: Exclude<ToolRunnerEvent, {type: "runner.tool.started"}>,
    result: AgentToolResult["result"],
  ): Exclude<ToolRunnerEvent, {type: "runner.tool.started"}> {
    const base = {
      callId: event.callId,
      toolName: event.toolName,
      startedAt: event.startedAt,
      endedAt: event.endedAt,
      durationMs: event.durationMs,
      result,
      timeoutMs: event.timeoutMs,
      metadata: event.metadata,
    };

    if (result.ok) {
      return {
        ...base,
        type: "runner.tool.completed",
      };
    }

    if (result.code === "TOOL_TIMEOUT") {
      return {
        ...base,
        type: "runner.tool.timed_out",
        errorCode: "TOOL_TIMEOUT",
      };
    }

    if (result.code === "TOOL_ABORTED") {
      return {
        ...base,
        type: "runner.tool.aborted",
        errorCode: "TOOL_ABORTED",
      };
    }

    return {
      ...base,
      type: "runner.tool.failed",
      errorCode: result.code,
    };
  }

  /** Creates a stable key for pending runner terminal events within one trace. */
  private toolRunnerEventKey(traceId: string, callId: string): string {
    return `${traceId}:${callId}`;
  }

  /** Removes any pending terminal runner events left behind by an ending run. */
  private deletePendingToolRunnerEvents(traceId: string): void {
    const prefix = `${traceId}:`;

    for (const key of this.pendingToolRunnerTerminalEvents.keys()) {
      if (key.startsWith(prefix)) {
        this.pendingToolRunnerTerminalEvents.delete(key);
      }
    }
  }

  /** Emits the standard run-start lifecycle events. */
  private emitRunStarted(
    input: AgentRunInput,
    sessionId: string,
    traceId: string,
    options: RunInternalOptions,
  ): void {
    const metadata = createEventMetadata(input, sessionId, traceId);

    emitAgentEvent(
      this.eventBus,
      {type: "runtime.session_started", sessionId, metadata},
      options,
    );
    emitAgentEvent(
      this.eventBus,
      {type: "runtime.status_changed", status: "running", metadata},
      options,
    );
    emitAgentEvent(
      this.eventBus,
      {type: "conversation.user_message", content: input.prompt, metadata},
      options,
    );
  }

  /** Emits the standard run-stop lifecycle events for completed or non-error stops. */
  private emitRunStopped(
    input: AgentRunInput,
    runId: string,
    sessionId: string,
    traceId: string,
    stopReason: AgentStopReason,
    options: RunInternalOptions,
  ): void {
    const metadata = createEventMetadata(input, sessionId, traceId);

    emitAgentEvent(
      this.eventBus,
      {type: "conversation.assistant_done", messageId: runId, metadata},
      options,
    );
    emitAgentEvent(
      this.eventBus,
      {
        type: "runtime.status_changed",
        status: stopReason === "completed" ? "complete" : "waiting",
        detail: stopReason,
        metadata,
      },
      options,
    );
    emitAgentEvent(
      this.eventBus,
      {type: "runtime.session_stopped", sessionId, metadata},
      options,
    );
  }

  /** Emits error lifecycle events when the agent run fails unexpectedly. */
  private emitRunFailed(
    input: AgentRunInput,
    sessionId: string,
    traceId: string,
    stopReason: AgentStopReason,
    error: unknown,
    options: RunInternalOptions,
  ): void {
    const metadata = createEventMetadata(input, sessionId, traceId);

    emitAgentEvent(
      this.eventBus,
      {
        type: "runtime.error",
        message: error instanceof Error ? error.message : "Agent run failed.",
        detail: error,
        metadata,
      },
      options,
    );
    emitAgentEvent(
      this.eventBus,
      {
        type: "runtime.status_changed",
        status: "error",
        detail: stopReason,
        metadata,
      },
      options,
    );
    emitAgentEvent(
      this.eventBus,
      {type: "runtime.session_stopped", sessionId, metadata},
      options,
    );
  }

  /** Emits the assistant stage event for the current model/tool loop iteration. */
  private emitAssistantStage(
    context: AgentRunContext,
    iteration: number,
    options: RunInternalOptions,
  ): void {
    emitAgentEvent(
      this.eventBus,
      {
        type: "conversation.assistant_stage",
        messageId: context.runId,
        stage: iteration === 1 ? "thinking" : "executing",
        metadata: createEventMetadata(context.input, context.sessionId, context.traceId),
      },
      options,
    );
  }

  /** Emits the task-started event used by runtime observers. */
  private emitTaskStarted(
    task: TaskRun,
    input: AgentRunInput,
    sessionId: string,
    traceId: string,
    options: RunInternalOptions,
  ): void {
    emitAgentEvent(
      this.eventBus,
      {
        type: "task.started",
        taskId: task.id,
        prompt: input.prompt,
        metadata: createEventMetadata(input, sessionId, traceId),
      },
      options,
    );
  }

  /** Emits change-set events after tracked workspace changes are checkpointed. */
  private emitChangeSetApplied(
    changeSet: ChangeSet,
    checkpointPath: string | undefined,
    context: AgentRunContext,
    options: RunInternalOptions,
  ): void {
    const files = changeSet.files.map((file) => file.path);
    const metadata = createEventMetadata(
      context.input,
      context.sessionId,
      context.traceId,
    );

    emitAgentEvent(
      this.eventBus,
      {type: "change_set.created", id: changeSet.id, files, metadata},
      options,
    );
    emitAgentEvent(
      this.eventBus,
      {
        type: "change_set.applied",
        id: changeSet.id,
        files,
        changes: changeSet.files,
        checkpointPath,
        metadata,
      },
      options,
    );
  }

  /** Emits the rollback-started event for a change set. */
  private emitChangeSetRollbackStarted(
    changeSet: ChangeSet,
    context: AgentRunContext,
    options: RunInternalOptions,
  ): void {
    emitAgentEvent(
      this.eventBus,
      {
        type: "change_set.rollback_started",
        id: changeSet.id,
        metadata: createEventMetadata(context.input, context.sessionId, context.traceId),
      },
      options,
    );
  }

  /** Emits the rollback-completed event for a change set. */
  private emitChangeSetRollbackCompleted(
    changeSet: ChangeSet,
    context: AgentRunContext,
    options: RunInternalOptions,
  ): void {
    emitAgentEvent(
      this.eventBus,
      {
        type: "change_set.rollback_completed",
        id: changeSet.id,
        metadata: createEventMetadata(context.input, context.sessionId, context.traceId),
      },
      options,
    );
  }

  /** Emits the verification-started event with selected verification commands. */
  private emitVerificationStarted(
    commands: readonly string[],
    input: AgentRunInput,
    sessionId: string,
    traceId: string,
    options: RunInternalOptions,
  ): void {
    emitAgentEvent(
      this.eventBus,
      {
        type: "verification.started",
        commands,
        metadata: createEventMetadata(input, sessionId, traceId),
      },
      options,
    );
  }

  /** Emits the verification-completed event for one verification batch. */
  private emitVerificationCompleted(
    results: readonly VerificationResult[],
    input: AgentRunInput,
    sessionId: string,
    traceId: string,
    options: RunInternalOptions,
  ): void {
    emitAgentEvent(
      this.eventBus,
      {
        type: "verification.completed",
        passed: results.every((result) => result.passed),
        commands: results.map((result) => result.command),
        metadata: createEventMetadata(input, sessionId, traceId),
      },
      options,
    );
  }

  /** Emits the trace-persisted event when trace storage produced a file path. */
  private emitTracePersisted(
    tracePath: string | undefined,
    input: AgentRunInput,
    sessionId: string,
    traceId: string,
    options: RunInternalOptions,
  ): void {
    if (!tracePath) {
      return;
    }

    emitAgentEvent(
      this.eventBus,
      {
        type: "trace.persisted",
        path: tracePath,
        metadata: createEventMetadata(input, sessionId, traceId),
      },
      options,
    );
  }

  /** Returns current EventBus history filtered to one trace for trace persistence. */
  private eventsForTrace(traceId: string): PixelleEvent[] {
    return this.eventBus.history().filter((event) => event.metadata?.traceId === traceId);
  }
}

/** Creates a default agent runtime from either full options or loaded config. */
export function createAgentRuntime(options: AgentOptions): Agent;
export function createAgentRuntime(config: AgentConfig): Agent;
export function createAgentRuntime(input: AgentOptions | AgentConfig): Agent {
  if ("runtime" in input && "llm" in input) {
    return new Agent({config: input});
  }

  return new Agent(input as AgentOptions);
}

/** Creates the product runtime by loading Pixelle config from pixelle.toml. */
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

/** Creates the initial task record tracked through the agent run lifecycle. */
function createTaskRun(runId: string): TaskRun {
  const now = Date.now();

  return {
    id: runId,
    runId,
    status: "created",
    createdAt: now,
    updatedAt: now,
    steps: [
      {id: "scan", title: "Scan workspace", status: "pending"},
      {id: "execute", title: "Execute agent loop", status: "pending"},
      {id: "verify", title: "Verify result", status: "pending"},
    ],
  };
}

/** Builds the prompt used to ask the model to repair a failed verification command. */
function buildRepairPrompt(failure: VerificationResult, repairAttempt: number): string {
  const output = [failure.stderr, failure.stdout].filter(Boolean).join("\n\n");

  return [
    `Verification failed on repair attempt ${repairAttempt}.`,
    `Command: ${failure.command}`,
    `Exit code: ${failure.exitCode ?? "none"}`,
    "Fix the issue using the available tools, then stop when the change is ready for verification.",
    "Verification output:",
    output.slice(0, 12_000),
  ].join("\n\n");
}
