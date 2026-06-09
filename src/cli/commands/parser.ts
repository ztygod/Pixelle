import type {CommandIntent, CommandRegistry} from "./types.js";

export function parseCommandIntent(
  input: string,
  registry: CommandRegistry,
): CommandIntent | undefined {
  const raw = input.trim();
  if (!raw.startsWith("/") || raw.length <= 1) {
    return undefined;
  }

  const [commandToken = "", ...args] = raw.slice(1).split(/\s+/);
  const command = registry.get(commandToken);
  if (command) {
    return {
      name: command.name,
      scope: command.scope,
      args,
      raw,
    };
  }

  return {
    name: commandToken,
    scope: "runtime",
    args,
    raw,
  };
}
