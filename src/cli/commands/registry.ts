import type {CommandDefinition, CommandRegistry} from "./types.js";

const DEFAULT_COMMANDS: readonly CommandDefinition[] = [
  {name: "clear", scope: "ui", aliases: ["cls"]},
  {name: "debug", scope: "ui"},
  {name: "help", scope: "ui", aliases: ["?"]},
  {name: "exit", scope: "ui", aliases: ["quit"]},
  {name: "config", scope: "runtime"},
  {name: "workspace", scope: "runtime"},
  {name: "edit", scope: "runtime"},
];

export function createCommandRegistry(
  commands: readonly CommandDefinition[] = DEFAULT_COMMANDS,
): CommandRegistry {
  const commandsByName = new Map<string, CommandDefinition>();

  for (const command of commands) {
    commandsByName.set(command.name, command);
    for (const alias of command.aliases ?? []) {
      commandsByName.set(alias, command);
    }
  }

  return {
    get(command) {
      return commandsByName.get(command);
    },
    list() {
      return [...new Set(commandsByName.values())];
    },
  };
}
