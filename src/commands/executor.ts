import {parseCommand} from "./parser.js";
import type {
  CommandExecutionContext,
  CommandExecutionResult,
  CommandRegistry,
} from "./types.js";

export function executeCommand(
  input: string,
  registry: CommandRegistry,
  context: CommandExecutionContext,
): CommandExecutionResult {
  const command = parseCommand(input, registry);
  if (!command) {
    return {handled: false};
  }

  const definition = registry.get(command.name);
  if (!definition) {
    return {handled: false};
  }

  definition.execute(command, context);
  return {handled: true, command};
}
