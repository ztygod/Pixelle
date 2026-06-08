import type {AgentConfig, RuntimeConfig} from "../config/index.js";
import type {PixelleEvent} from "../events/index.js";
import type {BaseLLMClient} from "../llm/index.js";
import type {
  LLMGenerateInput,
  LLMMessage,
  LLMResponse,
  LLMToolCall,
  LLMUsage,
} from "../llm/types.js";
import type {
  ToolFileWriter,
  ToolPermissions,
  ToolRegistry,
  ToolResult,
  ToolRunner,
} from "../tool/index.js";
import type {
  ChangeSet,
  CheckpointStore,
  TaskRun,
  TraceStore,
  VerificationResult,
  Verifier,
  WorkspaceProfile,
  WorkspaceScanner,
} from "../runtime/index.js";
import type {EventBus} from "../events/index.js";
import type {Agent} from "./agent.js";

/** Reason why an agent run stopped. */
export type AgentStopReason =
  | "completed"
  | "max_iterations"
  | "aborted"
  | "error";

/** Context that can be injected into the reserved runtime context section. */
export type AgentContextValue =
  | string
  | {
      title?: string;
      content: string;
      priority?: number;
    };

/** Deferred context provider used to attach dynamic runtime context. */
export type AgentContextProvider = {
  name: string;
  description?: string;
  build(context: AgentRunContext): AgentContextValue | Promise<AgentContextValue>;
};

/** User-facing input for one agent run. */
export type AgentRunInput = {
  prompt: string;
  mode?: "ask" | "edit";
  messages?: readonly LLMMessage[];
  systemPrompt?: string;
  context?: readonly AgentContextValue[];
  contextProviders?: readonly AgentContextProvider[];
  maxIterations?: number;
  maxRepairAttempts?: number;
  verification?: {
    enabled?: boolean;
    commands?: readonly string[];
  };
  rollbackOnFailure?: boolean;
  permissions?: ToolPermissions;
  metadata?: Record<string, unknown>;
  signal?: AbortSignal;
};

/** Mutable per-run state shared with middleware and context providers. */
export type AgentRunContext = {
  agent: Agent;
  config: AgentRuntimeConfig;
  input: AgentRunInput;
  runId: string;
  sessionId: string;
  traceId: string;
  iteration: number;
  signal?: AbortSignal;
  fileWriter?: ToolFileWriter;
  traceStore?: TraceStore;
  workspaceProfile?: WorkspaceProfile;
};

/** Model request enriched with agent trace data. */
export type AgentModelRequest = LLMGenerateInput & {
  iteration: number;
  runId: string;
};

/** Model response enriched with agent trace data. */
export type AgentModelResponse = LLMResponse & {
  iteration: number;
  runId: string;
};

/** Tool call enriched with the loop iteration that produced it. */
export type AgentToolCall = LLMToolCall & {
  iteration: number;
};

/** Structured result for one executed tool call. */
export type AgentToolResult = {
  call: AgentToolCall;
  result: ToolResult;
};

/** Complete result returned by Agent.run(). */
export type AgentRunResult = {
  runId: string;
  sessionId: string;
  traceId: string;
  content: string;
  messages: LLMMessage[];
  toolResults: AgentToolResult[];
  usage?: LLMUsage;
  iterations: number;
  stopReason: AgentStopReason;
  task?: TaskRun;
  changes?: ChangeSet[];
  verification?: VerificationResult[];
  workspaceProfile?: WorkspaceProfile;
  tracePath?: string;
  checkpointPath?: string;
  error?: unknown;
};

/** Lifecycle hooks for observing or mutating agent execution. */
export type AgentMiddleware = {
  beforeAgentRun?(context: AgentRunContext): void | Promise<void>;
  afterAgentRun?(
    result: AgentRunResult,
    context: AgentRunContext,
  ): AgentRunResult | void | Promise<AgentRunResult | void>;
  beforeModel?(
    request: AgentModelRequest,
    context: AgentRunContext,
  ): AgentModelRequest | void | Promise<AgentModelRequest | void>;
  afterModel?(
    response: AgentModelResponse,
    context: AgentRunContext,
  ): AgentModelResponse | void | Promise<AgentModelResponse | void>;
  beforeTool?(
    call: AgentToolCall,
    context: AgentRunContext,
  ): AgentToolCall | void | Promise<AgentToolCall | void>;
  afterTool?(
    toolResult: AgentToolResult,
    context: AgentRunContext,
  ): AgentToolResult | void | Promise<AgentToolResult | void>;
};

/** Runtime config accepted by the agent after config loading. */
export type AgentRuntimeConfig = {
  llm?: AgentConfig["llm"];
  runtime: RuntimeConfig;
};

/** Constructor options for wiring the agent to LLM, tools, events, and hooks. */
export type AgentOptions = {
  config: AgentRuntimeConfig | AgentConfig;
  llm?: BaseLLMClient;
  toolRegistry?: ToolRegistry;
  toolRunner?: ToolRunner;
  eventBus?: EventBus<PixelleEvent>;
  middleware?: readonly AgentMiddleware[];
  contextProviders?: readonly AgentContextProvider[];
  permissions?: ToolPermissions;
  traceStore?: TraceStore;
  checkpointStore?: CheckpointStore;
  workspaceScanner?: WorkspaceScanner;
  verifier?: Verifier;
};

export type RunInternalOptions = {
  eventSink?: (event: PixelleEvent) => void;
  runId?: string;
  sessionId?: string;
  traceId?: string;
};

export type StreamQueueItem =
  | {type: "event"; event: PixelleEvent}
  | {type: "done"}
  | {type: "error"; error: unknown};
