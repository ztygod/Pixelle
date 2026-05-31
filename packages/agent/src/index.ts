import type {PixelleEvent} from "@pixelle/events";
import {createPromptBuilder} from "@pixelle/prompt";
import type {AgentPrompt, PromptBuilder, PromptMessage} from "@pixelle/prompt";
import type {SessionId, ToolCallId} from "@pixelle/types";

export type CommandScope = "ui" | "runtime" | "tool" | "project";

export type CommandIntent = {
  raw: string;
  name: string;
  args: readonly string[];
  scope: CommandScope;
};

export type CommandDefinition = {
  name: string;
  scope: CommandScope;
  description: string;
};

export type CommandRegistry = {
  get(name: string): CommandDefinition | undefined;
  list(): readonly CommandDefinition[];
};

export const defaultCommandDefinitions: readonly CommandDefinition[] = [
  {
    name: "clear",
    scope: "ui",
    description: "Clear rendered workspace output.",
  },
  {
    name: "debug",
    scope: "ui",
    description: "Toggle debug metadata.",
  },
  {
    name: "help",
    scope: "ui",
    description: "Toggle command help.",
  },
  {
    name: "exit",
    scope: "ui",
    description: "Exit the current client.",
  },
  {
    name: "model",
    scope: "runtime",
    description: "Submit a model command to the agent runtime.",
  },
  {
    name: "mcp",
    scope: "runtime",
    description: "Submit an MCP command to the agent runtime.",
  },
  {
    name: "agent",
    scope: "runtime",
    description: "Submit an agent command to the agent runtime.",
  },
  {
    name: "tool",
    scope: "runtime",
    description: "Submit a tool command to the agent runtime.",
  },
];

export type RuntimeInput =
  | {type: "user_message"; sessionId: SessionId | string; content: string}
  | {type: "command"; sessionId: SessionId | string; command: CommandIntent};

export type RuntimeEventSink = {
  emit(event: PixelleEvent): void;
};

export type CreateSessionInput = {
  id?: SessionId | string;
};

export type AgentSession = {
  id: SessionId | string;
  createdAt: number;
  events: PixelleEvent[];
};

export type AgentSessionStore = {
  create(input?: CreateSessionInput): AgentSession;
  get(id: SessionId | string): AgentSession | undefined;
  appendEvents(id: SessionId | string, events: readonly PixelleEvent[]): void;
};

export type AgentRunResult = {
  sessionId: SessionId | string;
  eventsEmitted: number;
};

export type AgentRuntime = {
  createSession(input?: CreateSessionInput): Promise<AgentSession>;
  getSession(id: SessionId | string): Promise<AgentSession | undefined>;
  submit(input: RuntimeInput, sink: RuntimeEventSink): Promise<AgentRunResult>;
};

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  name: string;
  description: string;
  execute(input: TInput, context: ToolExecutionContext): Promise<TOutput>;
};

export type ToolExecutionContext = {
  session: AgentSession;
  emit(event: PixelleEvent): void;
};

export type ToolCall = {
  id?: ToolCallId | string;
  name: string;
  input?: unknown;
};

export type ModelRequest = {
  session: AgentSession;
  prompt: AgentPrompt;
  tools: readonly ToolDefinition[];
};

export type ModelResponse = {
  content?: string;
  toolCalls?: readonly ToolCall[];
};

export type ModelClient = {
  respond(request: ModelRequest): Promise<ModelResponse>;
};

export type AgentRuntimeOptions = {
  sessionStore?: AgentSessionStore;
  promptBuilder?: PromptBuilder;
  modelClient?: ModelClient;
  tools?: readonly ToolDefinition[];
  now?: () => number;
  createId?: (prefix: string) => string;
};

export type ContextBuilder<TContext = unknown> = {
  build(input: RuntimeInput): Promise<TContext>;
};

export function createCommandRegistry(
  commands: readonly CommandDefinition[] = defaultCommandDefinitions,
): CommandRegistry {
  const commandsByName = new Map(
    commands.map((command) => [command.name, command]),
  );

  return {
    get(name) {
      return commandsByName.get(name);
    },
    list() {
      return [...commandsByName.values()];
    },
  };
}

export function parseCommandIntent(
  input: string,
  registry: CommandRegistry,
): CommandIntent | undefined {
  const raw = input.trim();
  if (!raw.startsWith("/") || raw.length === 1) {
    return undefined;
  }

  const [commandToken, ...args] = raw.slice(1).split(/\s+/);
  if (!commandToken) {
    return undefined;
  }

  const definition = registry.get(commandToken);
  if (!definition) {
    return undefined;
  }

  return {
    raw,
    name: definition.name,
    args,
    scope: definition.scope,
  };
}

export function createInMemoryAgentSessionStore(
  options: Pick<AgentRuntimeOptions, "now" | "createId"> = {},
): AgentSessionStore {
  const sessions = new Map<string, AgentSession>();
  const now = options.now ?? Date.now;
  const createId = options.createId ?? createDefaultId;

  return {
    create(input = {}) {
      const session: AgentSession = {
        id: input.id ?? createId("session"),
        createdAt: now(),
        events: [],
      };
      sessions.set(String(session.id), session);
      return session;
    },
    get(id) {
      return sessions.get(String(id));
    },
    appendEvents(id, events) {
      const session = sessions.get(String(id));
      if (!session) {
        return;
      }
      session.events.push(...events);
    },
  };
}

export function createMockModelClient(): ModelClient {
  return {
    async respond(request) {
      const userInput = getLatestUserMessage(request.prompt.messages);
      return {
        content:
          `Pixelle runtime received: ${userInput}` +
          "\n\nThis response is produced by the default mock model client.",
      };
    },
  };
}

export function createAgentRuntime(
  options: AgentRuntimeOptions = {},
): AgentRuntime {
  const now = options.now ?? Date.now;
  const createId = options.createId ?? createDefaultId;
  const sessionStore =
    options.sessionStore ?? createInMemoryAgentSessionStore({now, createId});
  const promptBuilder = options.promptBuilder ?? createPromptBuilder();
  const modelClient = options.modelClient ?? createMockModelClient();
  const tools = [...(options.tools ?? [])];
  const toolsByName = new Map(tools.map((tool) => [tool.name, tool]));

  return {
    async createSession(input) {
      return sessionStore.create(input);
    },
    async getSession(id) {
      return sessionStore.get(id);
    },
    async submit(input, sink) {
      const session = sessionStore.get(input.sessionId);
      const emittedEvents: PixelleEvent[] = [];
      const emit = (event: PixelleEvent): void => {
        emittedEvents.push(event);
        sink.emit(event);
      };

      if (!session) {
        emit({
          type: "runtime.error",
          message: `Session not found: ${String(input.sessionId)}`,
          createdAt: now(),
          metadata: {sessionId: String(input.sessionId), source: "agent-runtime"},
        });
        return {sessionId: input.sessionId, eventsEmitted: emittedEvents.length};
      }

      const metadata = {
        sessionId: String(session.id),
        source: "agent-runtime",
      };

      try {
        emit({
          type: "runtime.status_changed",
          status: "running",
          detail: "Agent runtime started.",
          createdAt: now(),
          metadata,
        });

        if (input.type === "command") {
          emit({
            type: "runtime.command_received",
            command: input.command.name,
            args: input.command.args,
            raw: input.command.raw,
            createdAt: now(),
            metadata,
          });
          emit({
            type: "runtime.status_changed",
            status: "complete",
            detail: "Runtime command accepted.",
            createdAt: now(),
            metadata,
          });
          return {sessionId: session.id, eventsEmitted: emittedEvents.length};
        }

        const content = input.content.trim();
        emit({
          type: "conversation.user_message",
          id: createId("user"),
          content,
          createdAt: now(),
          metadata,
        });

        const prompt = await promptBuilder.build({
          userInput: content,
          history: toPromptHistory(session.events),
        });

        emit({
          type: "runtime.context_built",
          tokenEstimate: estimatePromptTokens(prompt),
          createdAt: now(),
          metadata,
        });

        const response = await modelClient.respond({session, prompt, tools});
        const messageId = createId("assistant");

        for (const toolCall of response.toolCalls ?? []) {
          const tool = toolsByName.get(toolCall.name);
          const toolCallId = toolCall.id ?? createId("tool");
          emit({
            type: "tool.call_started",
            id: toolCallId,
            name: toolCall.name,
            input: toolCall.input,
            description: tool?.description,
            status: "running",
            createdAt: now(),
            metadata,
          });

          if (!tool) {
            emit({
              type: "tool.call_failed",
              id: toolCallId,
              name: toolCall.name,
              error: `Tool not found: ${toolCall.name}`,
              createdAt: now(),
              metadata,
            });
            continue;
          }

          try {
            const output = await tool.execute(toolCall.input, {
              session,
              emit,
            });
            emit({
              type: "tool.call_completed",
              id: toolCallId,
              name: tool.name,
              output,
              summary: summarizeToolOutput(output),
              createdAt: now(),
              metadata,
            });
          } catch (error) {
            emit({
              type: "tool.call_failed",
              id: toolCallId,
              name: tool.name,
              error: getErrorMessage(error),
              createdAt: now(),
              metadata,
            });
          }
        }

        if (response.content) {
          emit({
            type: "conversation.assistant_delta",
            messageId,
            delta: response.content,
            stage: "complete",
            createdAt: now(),
            metadata,
          });
        }

        emit({
          type: "conversation.assistant_done",
          messageId,
          createdAt: now(),
          metadata,
        });
        emit({
          type: "runtime.status_changed",
          status: "complete",
          detail: "Agent runtime completed.",
          createdAt: now(),
          metadata,
        });

        return {sessionId: session.id, eventsEmitted: emittedEvents.length};
      } catch (error) {
        emit({
          type: "runtime.error",
          message: getErrorMessage(error),
          detail: error,
          createdAt: now(),
          metadata,
        });
        emit({
          type: "runtime.status_changed",
          status: "error",
          detail: getErrorMessage(error),
          createdAt: now(),
          metadata,
        });
        return {sessionId: session.id, eventsEmitted: emittedEvents.length};
      }
    },
  };
}

function createDefaultId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getLatestUserMessage(messages: readonly PromptMessage[]): string {
  return [...messages].reverse().find((message) => message.role === "user")
    ?.content ?? "";
}

function toPromptHistory(events: readonly PixelleEvent[]): PromptMessage[] {
  return events.flatMap((event): PromptMessage[] => {
    if (event.type === "conversation.user_message") {
      return [{role: "user", content: event.content}];
    }
    if (event.type === "conversation.assistant_delta") {
      return [{role: "assistant", content: event.delta}];
    }
    return [];
  });
}

function estimatePromptTokens(prompt: AgentPrompt): number {
  const characters = prompt.messages.reduce(
    (total, message) => total + message.content.length,
    0,
  );
  return Math.ceil(characters / 4);
}

function summarizeToolOutput(output: unknown): string | undefined {
  if (typeof output === "string") {
    return output.length > 80 ? `${output.slice(0, 77)}...` : output;
  }
  if (output === undefined) {
    return undefined;
  }
  return "Tool completed.";
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
