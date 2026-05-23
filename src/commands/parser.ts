import type {CommandRegistry, ParsedCommand} from "./types.js";

export function parseCommand(
  input: string,
  registry: CommandRegistry,
): ParsedCommand | undefined {
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
