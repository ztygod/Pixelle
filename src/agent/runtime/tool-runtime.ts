import {
  createDefaultToolRegistry,
  toLLMToolParametersSchema,
  ToolRunner,
  type ToolRegistry,
  type ToolRunnerEvent,
} from "../../tool/index.js";
import type {LLMTool} from "../../llm/types.js";
import {createToolContext} from "../runtime-utils.js";
import type {AgentMiddlewarePipeline} from "../middleware.js";
import type {AgentToolCall, AgentToolResult, AgentRuntimeConfig} from "../types.js";
import type {AgentObserver} from "./observer.js";
import type {AgentRunState} from "./run-state.js";
import type {RuntimePolicy} from "./policy.js";
import type {ChangeRuntime} from "./change-runtime.js";
import type {WorkspaceService} from "./workspace-service.js";

/** Dependencies used to expose and execute runtime tools. */
export type ToolRuntimeOptions = {
  /** Normalized agent config reserved for tool runtime options. */
  config: AgentRuntimeConfig;
  /** Workspace service that supplies tool workspace root. */
  workspace: WorkspaceService;
  /** Runtime policy used to resolve tool permissions and command checks. */
  policy: RuntimePolicy;
  /** Change runtime that supplies the run-scoped file writer. */
  changes: ChangeRuntime;
  /** Observer used to emit tool lifecycle events. */
  observer: AgentObserver;
  /** Middleware pipeline for before/after tool hooks. */
  middleware: AgentMiddlewarePipeline;
  /** Optional tool registry override. */
  toolRegistry?: ToolRegistry;
  /** Optional runner override for custom execution behavior. */
  toolRunner?: ToolRunner;
};

/** Owns tool schemas, execution context construction, and tool lifecycle events. */
export class ToolRuntime {
  private readonly registry: ToolRegistry;
  private readonly runner: ToolRunner;

  /** Creates a tool runtime using the default registry and ToolRunner when omitted. */
  constructor(private readonly options: ToolRuntimeOptions) {
    this.registry = options.toolRegistry ?? createDefaultToolRegistry();
    this.runner =
      options.toolRunner ??
      new ToolRunner(this.registry, {
        onEvent: (event) => this.handleRunnerEvent(event),
      });
  }

  /** Returns provider-neutral tool schemas to include in model requests. */
  schemas(): LLMTool[] {
    return this.registry.listDefinitions().map((definition) => ({
      name: definition.name,
      description: definition.description,
      inputSchema: toLLMToolParametersSchema(definition.parameters),
    }));
  }

  /** Executes model-requested tool calls sequentially and records results on run state. */
  async execute(
    run: AgentRunState,
    toolCalls: readonly AgentToolCall[],
  ): Promise<AgentToolResult[]> {
    const results: AgentToolResult[] = [];

    for (const call of toolCalls) {
      const toolCall = await this.options.middleware.beforeTool(call, run.context);
      this.options.observer.toolStarted(run, toolCall);
      const result = await this.runner.run(
        toolCall.name,
        toolCall.arguments,
        createToolContext({
          workspaceRoot: this.options.workspace.root,
          signal: run.input.signal,
          basePermissions: this.options.policy.toolPermissions(),
          runPermissions: run.input.permissions,
          fileWriter: run.context.fileWriter,
          workspaceProfile: run.workspaceProfile,
          commandPolicy: this.options.policy.commandPolicy,
        }),
        {
          callId: toolCall.id,
          metadata: this.options.observer.metadata(run),
        },
      );
      const toolResult = await this.options.middleware.afterTool(
        {call: toolCall, result},
        run.context,
      );
      run.toolResults.push(toolResult);
      results.push(toolResult);
      this.options.observer.toolCompleted(run, toolCall, toolResult.result);
    }

    return results;
  }

  private handleRunnerEvent(event: ToolRunnerEvent): void {
    const run = this.findRunForEvent(event);
    if (!run || event.type !== "runner.tool.streamed") {
      return;
    }

    this.options.observer.toolStreamed(
      run,
      {
        id: event.callId,
        name: event.toolName,
        arguments: {},
        iteration: run.iteration,
      },
      event.stream,
    );
  }

  private findRunForEvent(event: ToolRunnerEvent): AgentRunState | undefined {
    const traceId =
      typeof event.metadata?.traceId === "string" ? event.metadata.traceId : undefined;
    return traceId ? activeRunsByTraceId.get(traceId) : undefined;
  }
}

/** Active run lookup used to route ToolRunner stream events back to their run. */
const activeRunsByTraceId = new Map<string, AgentRunState>();

/** Registers a run so ToolRunner stream callbacks can find observer metadata. */
export function registerToolRuntimeRun(run: AgentRunState): void {
  activeRunsByTraceId.set(run.traceId, run);
}

/** Removes a run from the ToolRunner stream-event lookup table. */
export function unregisterToolRuntimeRun(run: AgentRunState): void {
  activeRunsByTraceId.delete(run.traceId);
}

/** Creates the default tool runtime. */
export function createToolRuntime(options: ToolRuntimeOptions): ToolRuntime {
  return new ToolRuntime(options);
}
