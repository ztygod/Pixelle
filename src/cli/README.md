# Pixelle CLI

`src/cli` is Pixelle's terminal presentation layer. It renders an event stream, captures user input, and exposes a small API for a separate runtime to drive the UI.

## Boundary

The CLI owns terminal layout, Markdown, code and diff rendering, assistant streaming, tool status rows, image preview fallback, local errors, and UI-only slash commands.

The CLI does not call models, run agents, execute tools, scan files, write files, use RAG, start MCP servers, or orchestrate runtime decisions.

## Commands

```sh
pnpm build
pnpm cli:demo
```

`pnpm cli:demo` pushes hardcoded timer events into `renderCli()`. It is useful for screenshots and visual checks, but it is not an Agent Runtime.

## Slash Commands

Slash commands only change local CLI UI state:

- `/help` toggles command help.
- `/clear` clears rendered messages, tools, images, and errors.
- `/debug` toggles event count, last event type, running tools, and terminal width in the status bar.
- `/exit` unmounts the Ink UI.

Non-command input is emitted through `onUserInput`.

## Public API

```ts
import {renderCli} from "./src/cli/index.js";

const cli = renderCli({title: "Pixelle"});

cli.onUserInput((input) => {
  console.log(input.content);
});

cli.pushEvent({
  type: "assistant_delta",
  messageId: "msg_1",
  delta: "Hello from a runtime event.",
});

cli.pushEvent({
  type: "assistant_done",
  messageId: "msg_1",
});
```

## EventBus

The internal event bus supports typed listeners, wildcard listeners, one-shot listeners, bounded history, replay, and clear:

```ts
eventBus.on("tool_start", handleToolStart);
eventBus.on("*", handleAnyEvent);
eventBus.once("error", handleFirstError);
eventBus.replay(handleAnyEvent, {limit: 20});
```

History is kept in memory only and defaults to the latest 200 events.

## Event Examples

```ts
cli.pushEvent({
  type: "tool_start",
  id: "tool_1",
  name: "list_files",
  description: "Scanning project...",
});

cli.pushEvent({
  type: "tool_done",
  id: "tool_1",
  name: "list_files",
  output: "src/App.tsx\nsrc/main.tsx",
  summary: "2 files",
});

cli.pushEvent({
  type: "image_preview",
  path: "./assets/login-design.png",
  alt: "Login design reference",
});
```

