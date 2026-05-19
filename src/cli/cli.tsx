import { render } from "ink";
import { App } from "./app/App.js";
import { EventBus } from "../eventsbus/index.js";
import type {
  CliEvent,
  CliEventBus,
  CliHandle,
  RenderCliOptions,
  UserInputBus,
  UserInputEvent,
} from "./types.js";

const CLI_VERSION = process.env.npm_package_version ?? "1.0.0";

export function renderCli(options: RenderCliOptions = {}): CliHandle {
  const eventBus: CliEventBus = new EventBus<CliEvent>();
  const userInputBus: UserInputBus = new EventBus<UserInputEvent>();
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
