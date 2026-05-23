import {useCallback, useMemo} from "react";
import {createCommandRegistry, executeCommand} from "../../commands/index.js";
import type {CliEvent, CliEventBus, UserInputBus} from "../types.js";
import {useTerminalSize} from "../hooks/useTerminalSize.js";
import {useCliState} from "../state/useCliState.js";
import {Layout} from "./Layout.js";

type AppProps = {
  title: string;
  version: string;
  eventBus: CliEventBus;
  userInputBus: UserInputBus;
  initialEvents?: CliEvent[];
  onExit: () => void;
};

export function App({
  title,
  version,
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
      const result = executeCommand(input, commandRegistry, {
        emitCliEvent(event) {
          eventBus.emit(event);
        },
        requestExit: onExit,
      });

      if (!result.handled) {
        userInputBus.emit({
          type: "submit",
          content: input,
        });
      }
    },
    [commandRegistry, eventBus, onExit, userInputBus],
  );

  return (
    <Layout
      title={title}
      version={version}
      cwd={process.cwd()}
      state={state}
      onSubmit={handleSubmit}
      width={width}
    />
  );
}

