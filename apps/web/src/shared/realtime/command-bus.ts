type CommandHandler<TCommand> = (command: TCommand) => void | Promise<void>;

export class CommandBus<TCommand extends {type: string}> {
  private readonly handlers = new Map<string, Set<CommandHandler<TCommand>>>();

  on(type: TCommand["type"], handler: CommandHandler<TCommand>) {
    const handlers = this.handlers.get(type) ?? new Set<CommandHandler<TCommand>>();
    handlers.add(handler);
    this.handlers.set(type, handlers);

    return () => {
      handlers.delete(handler);
    };
  }

  async dispatch(command: TCommand) {
    const handlers = this.handlers.get(command.type) ?? new Set<CommandHandler<TCommand>>();

    await Promise.all([...handlers].map((handler) => handler(command)));
  }
}
