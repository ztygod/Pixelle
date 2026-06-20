import {randomUUID} from "node:crypto";

import type {LLMMessage, LLMUsage} from "../../llm/types.js";
import type {
  ChangeSet,
  TaskRun,
  VerificationResult,
  WorkspaceProfile,
} from "../../runtime/index.js";
import type {
  AgentRunContext,
  AgentRunInput,
  AgentRunResult,
  AgentRuntimeConfig,
  AgentStopReason,
  AgentToolResult,
  RunInternalOptions,
} from "../types.js";

/** Dependencies and user input required to create one run-scoped state object. */
export type AgentRunStateOptions = {
  /** Agent instance exposed to legacy middleware and context providers. */
  agent: AgentRunContext["agent"];
  /** Normalized runtime configuration used for this run. */
  config: AgentRuntimeConfig;
  /** User-facing run input. */
  input: AgentRunInput;
  /** Internal stream/session overrides used by Agent.run() and Agent.stream(). */
  internalOptions?: RunInternalOptions;
};

/** Mutable state container shared by all runtime modules for one agent run. */
export class AgentRunState {
  /** Stable ID for this logical run. */
  readonly runId: string;
  /** Conversation/session ID; defaults to the run ID. */
  readonly sessionId: string;
  /** Correlation ID copied into emitted event metadata. */
  readonly traceId: string;
  /** Original user input for the run. */
  readonly input: AgentRunInput;
  /** Task lifecycle summary surfaced in the final result. */
  readonly task: TaskRun;
  /** Full model transcript accumulated during the run. */
  readonly messages: LLMMessage[] = [];
  /** Normalized tool results produced by model-requested tool calls. */
  readonly toolResults: AgentToolResult[] = [];
  /** Checkpointed change sets created by tools. */
  readonly changes: ChangeSet[] = [];
  /** Verification command results from initial and repair attempts. */
  readonly verification: VerificationResult[] = [];
  /** Compatibility context passed to middleware and context providers. */
  readonly context: AgentRunContext;
  /** Internal run options, including stream event sink. */
  readonly internalOptions: RunInternalOptions;

  /** Workspace metadata discovered before context construction. */
  workspaceProfile?: WorkspaceProfile;
  /** Latest assistant content used as final user-facing output. */
  content = "";
  /** Accumulated model usage across all model calls. */
  usage?: LLMUsage;
  /** Reason the agent loop stopped. */
  stopReason: AgentStopReason = "completed";
  /** Current model/tool loop iteration. */
  iteration = 0;
  /** Latest checkpoint path returned by the change runtime. */
  checkpointPath?: string;
  /** Error captured when the run fails unexpectedly. */
  error?: unknown;

  /** Creates a fresh run state and its legacy-compatible AgentRunContext. */
  constructor(options: AgentRunStateOptions) {
    this.internalOptions = options.internalOptions ?? {};
    this.runId = this.internalOptions.runId ?? randomUUID();
    this.sessionId = this.internalOptions.sessionId ?? this.runId;
    this.traceId = this.internalOptions.traceId ?? randomUUID();
    this.input = options.input;
    this.task = createTaskRun(this.runId);
    this.context = {
      agent: options.agent,
      config: options.config,
      input: options.input,
      iteration: 0,
      runId: this.runId,
      sessionId: this.sessionId,
      signal: options.input.signal,
      traceId: this.traceId,
    };
  }

  /** Returns whether the model/tool loop may execute another iteration. */
  canContinue(maxIterations: number): boolean {
    return !this.input.signal?.aborted && this.iteration < maxIterations;
  }

  /** Advances the run iteration and mirrors it onto the middleware context. */
  nextIteration(): number {
    this.iteration += 1;
    this.context.iteration = this.iteration;
    return this.iteration;
  }

  /** Marks the run completed and records the final assistant content if supplied. */
  complete(content?: string): void {
    this.content = content || this.content;
    this.stopReason = "completed";
  }

  /** Marks the run failed, preserving aborts as a distinct stop reason. */
  fail(error?: unknown): void {
    this.error = error;
    this.stopReason = this.input.signal?.aborted ? "aborted" : "error";
  }

  /** Converts the mutable run state into the public Agent.run() result shape. */
  toResult(): AgentRunResult {
    return {
      runId: this.runId,
      sessionId: this.sessionId,
      traceId: this.traceId,
      content: this.content,
      messages: this.messages,
      toolResults: this.toolResults,
      usage: this.usage,
      iterations: this.iteration,
      stopReason: this.stopReason,
      task: this.task,
      changes: this.changes,
      verification: this.verification,
      workspaceProfile: this.workspaceProfile,
      checkpointPath: this.checkpointPath,
      error: this.error,
    };
  }
}

/** Creates the lightweight task record associated with a run. */
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
