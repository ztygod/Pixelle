import type {LLMMessage} from "../../llm/types.js";
import {
  ContextEngine,
  RuleBasedContextCompressor,
  type BuildContextDiagnostics,
  type ContextSection,
} from "../../context/index.js";
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
  private readonly contextEngine = new ContextEngine({
    compressor: new RuleBasedContextCompressor(),
  });
  private readonly runStates = new WeakMap<AgentRunState, ContextManagerRunState>();

  /** Creates a context manager with static agent-level context providers. */
  constructor(private readonly options: ContextManagerOptions) {
    this.contextProviders = [...(options.contextProviders ?? [])];
  }

  /** Initializes static context sources and the mutable transcript for a run. */
  async prepare(run: AgentRunState): Promise<void> {
    const sections = [
      ...(await this.loadMemory(run)).map((value) => toContextSection(value, "memory")),
      ...(run.input.context ?? []).map((value) => toContextSection(value, "user")),
      {
        title: "Workspace Profile",
        priority: 100,
        content: JSON.stringify(run.workspaceProfile, null, 2),
        source: {kind: "workspace"},
      } satisfies ContextSection,
    ];

    /**
     * Context providers are deferred runtime context producers.
     *
     * They are useful when some context cannot be passed as static input,
     * and must be generated from the current AgentRunContext at run time.
     *
     * Common examples:
     * - Git status provider:
     *   injects current branch, modified files, staged files, or recent commits.
     *
     * - Run mode provider:
     *   injects mode-specific rules, such as "plan mode: do not modify files".
     *
     * - Diagnostics provider:
     *   injects recent test failures, lint errors, or command execution summaries.
     *
     * - External issue provider:
     *   injects GitHub / Linear / Jira issue details related to the current task.
     *
     * A provider may return either:
     * - a string, which will use provider.name as the context section title
     * - an AgentContextValue object, which may define its own title, priority, and content
     *
     * The returned value is converted into a ContextSection and then passed to
     * the generic src/context pipeline together with memory, user context, and
     * workspace profile sections.
     */
    const providers = [...this.contextProviders, ...(run.input.contextProviders ?? [])];

    for (const provider of providers) {
      const value = await provider.build(run.context);
      sections.push(
        typeof value === "string"
          ? {
              title: provider.name,
              content: value,
              source: {kind: "provider", ref: provider.name},
            }
          : {
              title: value.title ?? provider.name,
              ...value,
              source: {kind: "provider", ref: provider.name},
            },
      );
    }

    this.initializeRunState(run, sections);
    run.messages.push(...(run.input.messages ?? []));
    run.messages.push({role: "user", content: run.input.prompt});
  }

  /** Builds a fresh model transcript with dynamic runtime context. */
  buildModelRequest(run: AgentRunState): readonly LLMMessage[] {
    const state = this.getRunState(run);
    const projection = this.projectTranscript(run);
    const result = this.contextEngine.build({
      systemPrompt:
        run.input.systemPrompt ??
        this.options.config.runtime.systemPrompt ??
        DEFAULT_SYSTEM_PROMPT,
      outputInstructions: CLI_MARKDOWN_OUTPUT_INSTRUCTIONS,
      sections: [...state.baseSections, ...projection.archivedToolSections],
      tokenLimit: this.options.config.runtime.tokensLimit,
    });

    this.recordContextBuild(run, state, result.diagnostics);
    this.options.observer.contextBuilt(run, result.tokenEstimate);

    return [{role: "system", content: result.systemPrompt}, ...projection.messages];
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

  private initializeRunState(
    run: AgentRunState,
    baseSections: readonly ContextSection[],
  ): void {
    const state: ContextManagerRunState = {
      baseSections: [...baseSections],
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
      baseSections: [],
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

  private projectTranscript(run: AgentRunState): TranscriptProjection {
    const latestExchangeStart = findLatestCompletedToolExchangeStart(run.messages);
    const messages: LLMMessage[] = [];
    const archivedToolSections: ContextSection[] = [];

    for (let index = 0; index < run.messages.length; index += 1) {
      const message = run.messages[index];
      if (!message || message.role === "system") {
        continue;
      }

      if (isAssistantWithToolCalls(message)) {
        const exchange = readToolExchange(run.messages, index);
        if (exchange) {
          if (index === latestExchangeStart) {
            messages.push(message, ...exchange.toolMessages);
          } else {
            archivedToolSections.push(
              ...exchange.toolMessages.map((toolMessage) =>
                createToolResultSection(message, toolMessage),
              ),
            );
          }
          index = exchange.endIndex;
          continue;
        }
      }

      if (message.role !== "tool") {
        messages.push(message);
      }
    }

    return {messages, archivedToolSections};
  }
}

/** Creates the default context manager. */
export function createContextManager(options: ContextManagerOptions): ContextManager {
  return new ContextManager(options);
}

function toContextSection(
  value: AgentContextValue,
  source: "memory" | "user",
): ContextSection {
  if (typeof value === "string") {
    return {content: value, source: {kind: source}};
  }

  return {...value, source: {kind: source}};
}

type ContextManagerRunState = {
  baseSections: ContextSection[];
  contextBuilds: Array<{
    iteration: number;
    diagnostics?: BuildContextDiagnostics;
  }>;
  lastBuildDiagnostics?: BuildContextDiagnostics;
};

type TranscriptProjection = {
  messages: LLMMessage[];
  archivedToolSections: ContextSection[];
};

type AssistantToolMessage = Extract<LLMMessage, {role: "assistant"}> & {
  toolCalls: NonNullable<Extract<LLMMessage, {role: "assistant"}>["toolCalls"]>;
};

type ToolMessage = Extract<LLMMessage, {role: "tool"}>;

type ToolExchange = {
  toolMessages: ToolMessage[];
  endIndex: number;
};

function isAssistantWithToolCalls(message: LLMMessage): message is AssistantToolMessage {
  return (
    message.role === "assistant" &&
    Array.isArray(message.toolCalls) &&
    message.toolCalls.length > 0
  );
}

function readToolExchange(
  messages: readonly LLMMessage[],
  assistantIndex: number,
): ToolExchange | undefined {
  const assistant = messages[assistantIndex];
  if (!assistant || !isAssistantWithToolCalls(assistant)) {
    return undefined;
  }

  const expectedIds = new Set(assistant.toolCalls.map((toolCall) => toolCall.id));
  const toolMessages: ToolMessage[] = [];
  let index = assistantIndex + 1;

  while (index < messages.length) {
    const message = messages[index];
    if (!message || message.role !== "tool" || !expectedIds.has(message.toolCallId)) {
      break;
    }

    toolMessages.push(message);
    index += 1;

    if (toolMessages.length === expectedIds.size) {
      return {toolMessages, endIndex: index - 1};
    }
  }

  return undefined;
}

function findLatestCompletedToolExchangeStart(
  messages: readonly LLMMessage[],
): number | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (readToolExchange(messages, index)) {
      return index;
    }
  }

  return undefined;
}

function createToolResultSection(
  assistant: AssistantToolMessage,
  toolMessage: ToolMessage,
): ContextSection {
  return {
    id: `tool-result:${toolMessage.toolCallId}`,
    replaceKey: `tool-result:${toolMessage.toolCallId}`,
    title: `Tool Result: ${toolMessage.name}`,
    priority: 40,
    source: {kind: "tool", ref: toolMessage.toolCallId},
    content: [
      `Tool: ${toolMessage.name}`,
      `Call ID: ${toolMessage.toolCallId}`,
      assistant.content ? `Assistant: ${assistant.content}` : undefined,
      "Result:",
      toolMessage.content,
    ]
      .filter((line): line is string => Boolean(line))
      .join("\n"),
  };
}
