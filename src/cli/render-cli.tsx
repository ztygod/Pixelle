import {render} from "ink";
import {App} from "./app/App.js";
import {
  createCliEventBus,
  createUserInputBus,
} from "./events/event-bus.js";
import type {CliHandle, RenderCliOptions} from "./events/types.js";

const CLI_VERSION = process.env.npm_package_version ?? "1.0.0";

export function renderCli(options: RenderCliOptions = {}): CliHandle {
  const eventBus = createCliEventBus();
  const userInputBus = createUserInputBus();
  let instance: ReturnType<typeof render>;
  const onExit = () => {
    instance.unmount();
  };

  instance = render(
    <App
      title={options.title ?? "Pixelle"}
      version={CLI_VERSION}
      eventBus={eventBus}
      userInputBus={userInputBus}
      initialEvents={options.initialEvents}
      onExit={onExit}
    />,
  );

  return {
    pushEvent(event) {
      eventBus.emit(event);
    },
    onUserInput(callback) {
      return userInputBus.subscribe(callback);
    },
    unmount() {
      instance.unmount();
    },
  };
}
