import type {LLMMessage} from "../../llm/types.js";
import type {
  AgentContextProvider,
  AgentContextValue,
  AgentModelResponse,
  AgentRuntimeConfig,
  AgentToolResult,
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
  private readonly contextProviders: AgentContextProvider[];

  /** Creates a context manager with static agent-level context providers. */
  constructor(private readonly options: ContextManagerOptions) {
    this.contextProviders = [...(options.contextProviders ?? [])];
  }

  /** Builds the initial system, history, and user messages for a run. */
  async prepare(run: AgentRunState): Promise<void> {
    const values = [
      ...(await this.loadMemory(run)),
      ...(run.input.context ?? []),
      {
        title: "Workspace Profile",
        priority: 100,
        content: JSON.stringify(run.workspaceProfile, null, 2),
      },
    ];
    const providers = [...this.contextProviders, ...(run.input.contextProviders ?? [])];

    for (const provider of providers) {
      const value = await provider.build(run.context);
      values.push(
        typeof value === "string"
          ? {title: provider.name, content: value}
          : {title: value.title ?? provider.name, ...value},
      );
    }

    const contextText = truncateContext(
      values.sort(compareContextValue).map(formatContextValue).filter(Boolean),
      this.options.config.runtime.tokensLimit,
    );
    this.options.observer.contextBuilt(run, estimateTokens(contextText));
    const systemPrompt = buildSystemPrompt(
      run.input.systemPrompt ?? this.options.config.runtime.systemPrompt,
      contextText,
    );

    run.messages.push({role: "system", content: systemPrompt});
    run.messages.push(...(run.input.messages ?? []));
    run.messages.push({role: "user", content: run.input.prompt});
  }

  /** Returns the current transcript to send to the model runtime. */
  buildModelRequest(run: AgentRunState): readonly LLMMessage[] {
    return run.messages;
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

  private async loadMemory(run: AgentRunState): Promise<AgentContextValue[]> {
    const runMemory = await this.options.memory.loadRunMemory?.(run);
    const projectMemory = await this.options.memory.loadProjectMemory?.(run);
    return [...(projectMemory ?? []), ...(runMemory ?? [])];
  }
}

/** Creates the default context manager. */
export function createContextManager(options: ContextManagerOptions): ContextManager {
  return new ContextManager(options);
}

/** Estimates tokens using the runtime's coarse character-based heuristic. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Combines the configured system prompt, CLI instructions, and runtime context. */
function buildSystemPrompt(
  systemPrompt: string | undefined,
  contextText: string,
): string {
  const prompt = systemPrompt ?? DEFAULT_SYSTEM_PROMPT;
  const promptWithCliInstructions = `${prompt}\n\n${CLI_MARKDOWN_OUTPUT_INSTRUCTIONS}`;

  if (!contextText) {
    return promptWithCliInstructions;
  }

  return `${promptWithCliInstructions}\n\n# Runtime Context\n${contextText}`;
}

function formatContextValue(value: AgentContextValue): string {
  if (typeof value === "string") {
    return value.trim();
  }

  const content = value.content.trim();
  if (!content) {
    return "";
  }

  return value.title ? `## ${value.title}\n${content}` : content;
}

function compareContextValue(left: AgentContextValue, right: AgentContextValue): number {
  return getContextPriority(right) - getContextPriority(left);
}

function getContextPriority(value: AgentContextValue): number {
  return typeof value === "string" ? 0 : (value.priority ?? 0);
}

function truncateContext(blocks: string[], tokenLimit: number): string {
  const maxChars = Math.max(0, Math.floor(tokenLimit * 4 * 0.35));
  let remaining = maxChars;
  const selectedBlocks: string[] = [];

  for (const block of blocks) {
    if (remaining <= 0) {
      break;
    }

    const separatorLength = selectedBlocks.length ? 2 : 0;
    const allowed = remaining - separatorLength;
    if (allowed <= 0) {
      break;
    }

    selectedBlocks.push(block.length > allowed ? block.slice(0, allowed) : block);
    remaining -= Math.min(block.length, allowed) + separatorLength;
  }

  return selectedBlocks.join("\n\n");
}
