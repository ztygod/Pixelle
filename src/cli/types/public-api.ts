import type {CliEvent, UserInputEvent} from "./events.js";

export type RenderCliOptions = {
  title?: string;
  initialEvents?: CliEvent[];
};

export type CliHandle = {
  pushEvent(event: CliEvent): void;
  onUserInput(callback: (input: UserInputEvent) => void): () => void;
  unmount(): void;
};
