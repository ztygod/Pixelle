import {render} from "ink";
import {App} from "./app/App.js";
import {EventBus} from "../events/index.js";
import type {
  CliEvent,
  CliEventBus,
  CliHandle,
  RenderCliOptions,
  RuntimeCommandEvent,
  UserInputBus,
  UserInputEvent,
} from "./types.js";

const CLI_VERSION = process.env.npm_package_version ?? "1.0.0";

export function renderCli(options: RenderCliOptions = {}): CliHandle {
  const eventBus: CliEventBus = new EventBus<CliEvent>();
  const userInputBus: UserInputBus = new EventBus<UserInputEvent>();
  const onExit = () => {
    instance.unmount();
  };

  const instance = render(
    <App
      title={options.title ?? "Pixelle"}
      version={CLI_VERSION}
      cwd={options.cwd ?? process.cwd()}
      model={options.model}
      provider={options.provider}
      gitBranch={options.gitBranch}
      gitStatus={options.gitStatus}
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
    onRuntimeCommand(callback) {
      return eventBus.on("runtime_command", (event) => {
        if (event.type === "runtime_command") {
          callback(event as RuntimeCommandEvent);
        }
      });
    },
    unmount() {
      instance.unmount();
    },
  };
}
