import type {AgentConfig} from "../config/index.js";
import type {EventBus, PixelleEvent} from "../events/index.js";
import type {BaseLLMClient} from "../llm/index.js";
import type {LLMTool, LLMUsage} from "../llm/types.js";
import type {CommandPolicyLike, WorkspaceProfile} from "../runtime/index.js";
import {
  toLLMToolParametersSchema,
  type ToolContext,
  type ToolFileWriter,
  type ToolPermissions,
  type ToolStreamChunk,
  type ToolRegistry,
  type ToolResult,
} from "../tool/index.js";
import type {AgentRunInput, AgentRuntimeConfig, RunInternalOptions} from "./types.js";

export const DEFAULT_PERMISSIONS: Required<ToolPermissions> = {
  readFile: true,
  writeFile: false,
  network: false,
  shell: false,
};

export const DEFAULT_MAX_ITERATIONS = 12;
export const DEFAULT_MAX_REPAIR_ATTEMPTS = 2;
export const DEFAULT_TOKEN_LIMIT = 32_000;
export const DEFAULT_SYSTEM_PROMPT =
  "You are Pixelle, an autonomous coding agent. Solve the user's request by reasoning carefully, using tools when needed, and explaining the final outcome clearly.";

export const CLI_MARKDOWN_OUTPUT_INSTRUCTIONS = [
  "# CLI Output Format",
  "Format responses for a terminal-based coding agent UI.",
  "- Use concise Markdown with short headings, short paragraphs, and lists.",
  "- Do not use Markdown tables. Convert tabular information into bullets or compact sections.",
  "- Avoid very long single lines; wrap prose naturally.",
  "- Use fenced code blocks for code and always include a language identifier.",
  "- Keep tool details, file changes, and raw JSON out of assistant prose unless the user asks for them.",
].join("\n");

/** Applies runtime defaults without mutating the caller's config object. */
export function normalizeConfig(
  config: AgentRuntimeConfig | AgentConfig,
): AgentRuntimeConfig {
  return {
    ...config,
    runtime: {
      maxIterations: config.runtime.maxIterations ?? DEFAULT_MAX_ITERATIONS,
      maxRepairAttempts: config.runtime.maxRepairAttempts ?? DEFAULT_MAX_REPAIR_ATTEMPTS,
      tokensLimit: config.runtime.tokensLimit ?? DEFAULT_TOKEN_LIMIT,
      systemPrompt: config.runtime.systemPrompt ?? DEFAULT_SYSTEM_PROMPT,
      workspaceDir: config.runtime.workspaceDir,
      rollbackOnFailure: config.runtime.rollbackOnFailure ?? true,
    },
    permissions: {
      ...DEFAULT_PERMISSIONS,
      ...config.permissions,
    },
    verification: {
      enabled: config.verification?.enabled ?? true,
      commands: [...(config.verification?.commands ?? [])],
    },
    trace: {
      enabled: config.trace?.enabled ?? true,
      directory: config.trace?.directory ?? config.runtime.workspaceDir,
    },
  };
}

export function missingLLMClient(): BaseLLMClient {
  throw new Error("Agent requires either config.llm or an explicit llm client.");
}

/** Creates trace metadata shared by all events emitted during a run. */
export function createEventMetadata(
  input: AgentRunInput,
  sessionId: string,
  traceId: string,
): Record<string, unknown> {
  return {
    ...input.metadata,
    sessionId,
    traceId,
    source: "agent",
  };
}

/** Emits to the shared event bus and optionally mirrors the event to stream(). */
export function emitAgentEvent(
  eventBus: EventBus<PixelleEvent>,
  event: PixelleEvent,
  options: RunInternalOptions,
): void {
  const publishedEvent = eventBus.emit(event);
  options.eventSink?.(publishedEvent ?? event);
}

/** Converts registered runtime tools into provider-neutral LLM tool schemas. */
export function buildLLMTools(toolRegistry: ToolRegistry): LLMTool[] {
  return toolRegistry.listDefinitions().map((definition) => ({
    name: definition.name,
    description: definition.description,
    inputSchema: toLLMToolParametersSchema(definition.parameters),
  }));
}

/** Merges conservative defaults, agent-level permissions, and per-run overrides. */
export function mergePermissions(
  base?: ToolPermissions,
  override?: ToolPermissions,
): ToolPermissions {
  return {
    ...DEFAULT_PERMISSIONS,
    ...base,
    ...override,
  };
}

/** Builds the execution context passed to ToolRunner. */
export function createToolContext(input: {
  workspaceRoot: string;
  signal?: AbortSignal;
  basePermissions?: ToolPermissions;
  runPermissions?: ToolPermissions;
  fileWriter?: ToolFileWriter;
  workspaceProfile?: WorkspaceProfile;
  commandPolicy?: CommandPolicyLike;
  emitStream?: (chunk: ToolStreamChunk) => void | Promise<void>;
}): ToolContext {
  return {
    workspaceRoot: input.workspaceRoot,
    signal: input.signal,
    permissions: mergePermissions(input.basePermissions, input.runPermissions),
    fileWriter: input.fileWriter,
    workspaceProfile: input.workspaceProfile,
    commandPolicy: input.commandPolicy,
    emitStream: input.emitStream,
  };
}

export function stringifyToolResult(result: ToolResult): string {
  return JSON.stringify(result);
}

/** Adds provider usage across model calls while preserving unknown fields. */
export function mergeUsage(
  current: LLMUsage | undefined,
  next: LLMUsage | undefined,
): LLMUsage | undefined {
  if (!current) {
    return next;
  }
  if (!next) {
    return current;
  }

  return {
    inputTokens: addOptional(current.inputTokens, next.inputTokens),
    outputTokens: addOptional(current.outputTokens, next.outputTokens),
    totalTokens: addOptional(current.totalTokens, next.totalTokens),
  };
}

function addOptional(
  left: number | undefined,
  right: number | undefined,
): number | undefined {
  if (left === undefined && right === undefined) {
    return undefined;
  }

  return (left ?? 0) + (right ?? 0);
}
