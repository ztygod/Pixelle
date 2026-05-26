import type {AgentEvent} from "@pixelle/events";

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

export type RuntimeInput =
  | {type: "user_message"; content: string}
  | {type: "command"; command: CommandIntent};

export type RuntimeEventSink = {
  emit(event: AgentEvent): void;
};

export type AgentRuntime = {
  submit(input: RuntimeInput, sink: RuntimeEventSink): Promise<void>;
};

export type ToolDefinition<TInput = unknown, TOutput = unknown> = {
  name: string;
  description: string;
  execute(input: TInput): Promise<TOutput>;
};

export type ContextBuilder<TContext = unknown> = {
  build(input: RuntimeInput): Promise<TContext>;
};

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
