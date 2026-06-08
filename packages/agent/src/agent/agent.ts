import {randomUUID} from "node:crypto";

import {EventBus, type PixelleEvent} from "../eventsbus/index.js";
import {LLMClient, type BaseLLMClient} from "../llm/index.js";
import type {LLMMessage, LLMUsage} from "../llm/types.js";
import {
  createDefaultToolRegistry,
  ToolRegistry,
  ToolRunner,
  type ToolPermissions,
} from "../tool/index.js";
import {buildRuntimeContext, buildSystemPrompt} from "./context.js";
import {DEFAULT_MAX_ITERATIONS, missingLLMClient, normalizeConfig} from "./defaults.js";
import {createEventMetadata, emitAgentEvent} from "./events.js";
import {AgentMiddlewarePipeline} from "./middleware.js";
import {buildLLMTools, createToolContext, mergePermissions, stringifyToolResult} from "./tools.js";
import {mergeUsage} from "./usage.js";
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
  private readonly middleware: AgentMiddleware[];
  private readonly middlewarePipeline: AgentMiddlewarePipeline;
  private readonly contextProviders: AgentContextProvider[];
  private readonly permissions: ToolPermissions;

  constructor(options: AgentOptions) {
    this.config = normalizeConfig(options.config);
    this.llm =
      options.llm ??
      (this.config.llm
        ? new LLMClient(this.config.llm)
        : missingLLMClient());
    this.toolRegistry = options.toolRegistry ?? createDefaultToolRegistry();
    this.toolRunner = options.toolRunner ?? new ToolRunner(this.toolRegistry);
    this.eventBus = options.eventBus ?? new EventBus<PixelleEvent>();
    this.middleware = [...(options.middleware ?? [])];
    this.middlewarePipeline = new AgentMiddlewarePipeline(this.middleware);
    this.contextProviders = [...(options.contextProviders ?? [])];
    this.permissions = mergePermissions(options.permissions);
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

  private async runInternal(
    input: AgentRunInput,
    options: RunInternalOptions,
  ): Promise<AgentRunResult> {
    const runId = options.runId ?? randomUUID();
    const sessionId = options.sessionId ?? runId;
    const traceId = options.traceId ?? randomUUID();
    const maxIterations =
      input.maxIterations ??
      this.config.runtime.maxIterations ??
      DEFAULT_MAX_ITERATIONS;
    const context = this.createRunContext({
      input,
      runId,
      sessionId,
      traceId,
    });
    const messages: LLMMessage[] = [];
    const toolResults: AgentToolResult[] = [];
    let content = "";
    let stopReason: AgentStopReason = "completed";
    let usage: LLMUsage | undefined;

    try {
      this.emitRunStarted(input, sessionId, traceId, options);
      await this.middlewarePipeline.beforeAgentRun(context);

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
        await this.middlewarePipeline.beforeIteration(context);
        this.emitAssistantStage(context, iteration, options);

        const response = await this.generateModelResponse({
          context,
          iteration,
          messages,
          tools,
        });
        usage = mergeUsage(usage, response.usage);
        content = response.content || content;

        this.emitAssistantContent(response, context, options);
        messages.push({
          role: "assistant",
          content: response.content,
          toolCalls: response.toolCalls,
        });
        await this.middlewarePipeline.afterIteration(context, response);

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

        if (iteration === maxIterations) {
          stopReason = "max_iterations";
        }
      }

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
        },
        context,
      );

      this.emitRunStopped(input, runId, sessionId, traceId, stopReason, options);
      return result;
    } catch (error) {
      stopReason = input.signal?.aborted ? "aborted" : "error";
      await this.middlewarePipeline.onAgentError(error, context);
      this.emitRunFailed(input, sessionId, traceId, stopReason, error, options);

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
        error,
      };
    }
  }

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

  private async addInitialMessages(
    messages: LLMMessage[],
    context: AgentRunContext,
    options: RunInternalOptions,
  ): Promise<void> {
    const contextText = await buildRuntimeContext({
      context,
      middleware: this.middlewarePipeline,
      contextProviders: this.contextProviders,
      eventBus: this.eventBus,
      options,
    });
    const systemPrompt = buildSystemPrompt(context, contextText);

    messages.push({role: "system", content: systemPrompt});
    messages.push(...(context.input.messages ?? []));
    messages.push({role: "user", content: context.input.prompt});
  }

  private async generateModelResponse(input: {
    context: AgentRunContext;
    iteration: number;
    messages: LLMMessage[];
    tools: ReturnType<typeof buildLLMTools>;
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
    const rawResponse = await this.llm.generate(request);

    return this.middlewarePipeline.afterModel(
      {
        ...rawResponse,
        iteration: input.iteration,
        runId: input.context.runId,
      },
      input.context,
    );
  }

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

    // ToolRunner owns schema validation and tool-level error normalization.
    const result = await this.toolRunner.run(
      toolCall.name,
      toolCall.arguments,
      createToolContext({
        workspaceRoot: this.config.runtime.workspaceDir,
        signal: context.input.signal,
        basePermissions: this.permissions,
        runPermissions: context.input.permissions,
      }),
    );
    const toolResult = await this.middlewarePipeline.afterTool(
      {call: toolCall, result},
      context,
    );

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
      await this.middlewarePipeline.onToolError(toolResult, context);
      emitAgentEvent(
        this.eventBus,
        {
          type: "tool.call_failed",
          id: toolCall.id,
          name: toolCall.name,
          error: toolResult.result.message,
          metadata,
        },
        options,
      );
    }

    return toolResult;
  }

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
        metadata: createEventMetadata(
          context.input,
          context.sessionId,
          context.traceId,
        ),
      },
      options,
    );
  }

  private emitAssistantContent(
    response: AgentModelResponse,
    context: AgentRunContext,
    options: RunInternalOptions,
  ): void {
    if (!response.content) {
      return;
    }

    emitAgentEvent(
      this.eventBus,
      {
        type: "conversation.assistant_delta",
        messageId: context.runId,
        delta: response.content,
        stage: response.toolCalls.length ? "planning" : "complete",
        metadata: createEventMetadata(
          context.input,
          context.sessionId,
          context.traceId,
        ),
      },
      options,
    );
  }
}
