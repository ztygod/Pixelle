import {render} from "ink";
import {App} from "./app.js";
import {
  createCliEventBus,
  createUserInputBus,
} from "./adapters/event-bus.js";
import type {CliHandle, RenderCliOptions} from "./types/public-api.js";

export function renderCli(options: RenderCliOptions = {}): CliHandle {
  const eventBus = createCliEventBus();
  const userInputBus = createUserInputBus();
  const instance = render(
    <App
      title={options.title ?? "Pixelle"}
      eventBus={eventBus}
      userInputBus={userInputBus}
      initialEvents={options.initialEvents}
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
