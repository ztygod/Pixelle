import {useCallback, useMemo} from "react";
import {createCommandRegistry, parseCommandIntent} from "../commands/index.js";
import type {CliEvent, CliEventBus, UserInputBus} from "../types.js";
import {useTerminalSize} from "../hooks/useTerminalSize.js";
import {useCliState} from "../state/useCliState.js";
import {Layout} from "./Layout.js";

type AppProps = {
  title: string;
  version: string;
  cwd: string;
  model?: string;
  provider?: string;
  gitBranch?: string;
  gitStatus?: "clean" | "modified" | "unknown";
  eventBus: CliEventBus;
  userInputBus: UserInputBus;
  initialEvents?: CliEvent[];
  onExit: () => void;
};

export function App({
  title,
  version,
  cwd,
  model,
  provider,
  gitBranch,
  gitStatus,
  eventBus,
  userInputBus,
  initialEvents,
  onExit,
}: AppProps) {
  const {state} = useCliState(eventBus, initialEvents);
  const {width} = useTerminalSize();
  const commandRegistry = useMemo(() => createCommandRegistry(), []);
  const handleSubmit = useCallback(
    (input: string) => {
      const command = parseCommandIntent(input, commandRegistry);
      if (!command) {
        userInputBus.emit({
          type: "submit",
          content: input,
        });
        return;
      }

      if (command.scope === "ui") {
        switch (command.name) {
          case "clear":
            eventBus.emit({type: "cli_clear"});
            return;
          case "debug":
            eventBus.emit({type: "cli_debug_toggle"});
            return;
          case "help":
            eventBus.emit({type: "cli_help_toggle"});
            return;
          case "exit":
            onExit();
            return;
        }
      }

      eventBus.emit({
        type: "runtime_command",
        command: command.name,
        args: command.args,
        raw: command.raw,
      });
    },
    [commandRegistry, eventBus, onExit, userInputBus],
  );

  return (
    <Layout
      title={title}
      version={version}
      cwd={cwd}
      model={model}
      provider={provider}
      gitBranch={gitBranch}
      gitStatus={gitStatus}
      state={state}
      onSubmit={handleSubmit}
      width={width}
    />
  );
}
