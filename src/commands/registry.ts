import type {CommandDefinition, CommandRegistry} from "./types.js";

const UI_COMMANDS: CommandDefinition[] = [
  {
    name: "clear",
    scope: "ui",
    description: "Clear rendered CLI output.",
    execute(_command, context) {
      context.emitCliEvent({type: "cli_clear"});
    },
  },
  {
    name: "debug",
    scope: "ui",
    description: "Toggle CLI debug status.",
    execute(_command, context) {
      context.emitCliEvent({type: "cli_debug_toggle"});
    },
  },
  {
    name: "help",
    scope: "ui",
    description: "Toggle CLI command help.",
    execute(_command, context) {
      context.emitCliEvent({type: "cli_help_toggle"});
    },
  },
  {
    name: "exit",
    scope: "ui",
    description: "Exit the CLI.",
    execute(_command, context) {
      context.requestExit();
    },
  },
];

const RUNTIME_COMMANDS: CommandDefinition[] = [
  "model",
  "mcp",
  "agent",
  "tool",
].map<CommandDefinition>((name) => ({
  name,
  scope: "runtime",
  description: `Submit /${name} to the agent runtime.`,
  execute(command, context) {
    context.emitCliEvent({
      type: "runtime_command",
      command: command.name,
      args: command.args,
      raw: command.raw,
    });
  },
}));

export function createCommandRegistry(
  commands: readonly CommandDefinition[] = [
    ...UI_COMMANDS,
    ...RUNTIME_COMMANDS,
  ],
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
