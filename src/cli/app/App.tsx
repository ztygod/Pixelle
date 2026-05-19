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
  const {state, runCommand} = useCliState(eventBus, initialEvents);
  const {width} = useTerminalSize();

  return (
    <Layout
      title={title}
      version={version}
      cwd={process.cwd()}
      state={state}
      userInputBus={userInputBus}
      runCommand={runCommand}
      width={width}
      onExit={onExit}
    />
  );
}

