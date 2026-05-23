import type {CliEvent} from "../cli/types.js";

export type CommandScope = "ui" | "runtime";

export type ParsedCommand = {
  raw: string;
  name: string;
  args: readonly string[];
  scope: CommandScope;
};

export type CommandExecutionContext = {
  emitCliEvent(event: CliEvent): void;
  requestExit(): void;
};

export type CommandExecutionResult =
  | {handled: true; command: ParsedCommand}
  | {handled: false};

export type CommandDefinition = {
  name: string;
  scope: CommandScope;
  description: string;
  execute(command: ParsedCommand, context: CommandExecutionContext): void;
};

export type CommandRegistry = {
  get(name: string): CommandDefinition | undefined;
  list(): readonly CommandDefinition[];
};
