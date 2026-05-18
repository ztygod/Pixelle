import type {UserInputBus} from "../adapters/event-bus.js";

export function submitUserInput(userInputBus: UserInputBus, content: string): void {
  const trimmed = content.trim();
  if (trimmed.length === 0) {
    return;
  }

  userInputBus.emit({
    type: "submit",
    content: trimmed,
    createdAt: Date.now(),
  });
}
