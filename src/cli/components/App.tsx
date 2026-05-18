import type {CliEventBus, UserInputBus} from "../adapters/event-bus.js";
import {useCliEvents} from "../hooks/useCliEvents.js";
import {useTerminalSize} from "../hooks/useTerminalSize.js";
import type {CliEvent} from "../types/events.js";
import {Layout} from "./Layout.js";

type AppProps = {
  title: string;
  eventBus: CliEventBus;
  userInputBus: UserInputBus;
  initialEvents?: CliEvent[];
};

export function App({title, eventBus, userInputBus, initialEvents}: AppProps) {
  const state = useCliEvents(eventBus, initialEvents);
  const {width} = useTerminalSize();

  return (
    <Layout
      title={title}
      messages={state.messages}
      tools={state.tools}
      images={state.images}
      userInputBus={userInputBus}
      width={width}
      lastError={state.lastError}
    />
  );
}
