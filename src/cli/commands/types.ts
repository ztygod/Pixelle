export type CommandScope = "ui" | "runtime";

export type CommandDefinition<TName extends string = string> = {
  name: TName;
  scope: CommandScope;
  aliases?: readonly string[];
};

export type CommandIntent<TName extends string = string> = {
  name: TName;
  scope: CommandScope;
  args: readonly string[];
  raw: string;
};

export type CommandRegistry = {
  get(command: string): CommandDefinition | undefined;
  list(): readonly CommandDefinition[];
};
