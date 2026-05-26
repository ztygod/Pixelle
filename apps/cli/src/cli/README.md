# Pixelle CLI

`apps/cli/src/cli` is Pixelle's terminal presentation layer. It renders an event stream, captures user input, and exposes a small API for a separate runtime to drive the UI.

## Boundary

The CLI owns terminal layout, Markdown, code and diff rendering, assistant streaming, tool status rows, image preview fallback, and local errors.

The CLI does not call models, run agents, execute tools, scan files, write files, use RAG, start MCP servers, or orchestrate runtime decisions.

Slash command parsing and shared command definitions live in `packages/core`. The CLI maps UI command intents into terminal events. Runtime-facing commands emit a runtime command intent that an agent runtime can subscribe to through the CLI handle.

`apps/cli/src/cli/index.ts` is a side-effect-free public API entry. The executable CLI entry lives in `apps/cli/src/bin/pixelle.ts`. Demo programs live under `demos/` and consume the CLI through the public API.

## Structure

`app/` owns the top-level Ink composition and wires input into the commands layer. `state/` owns event reduction and selectors. `components/chrome/` contains shell UI such as the welcome screen, status bar, command help, and input box. `components/timeline/` contains renderers for chronological content. `components/markdown/` contains Markdown and code rendering helpers.

The render data flow is:

```text
EventBus -> useCliState -> reduceCliState -> selectTimelineItems -> Timeline -> TimelineItem
```

Messages, tools, images, and errors are rendered through the timeline selector so new content appears chronologically above the input box. Assistant deltas are still merged by the reducer before rendering.

## Commands

```sh
pnpm build
pnpm cli:demo
```

`pnpm cli:demo` pushes hardcoded timer events into `renderCli()`. It is useful for screenshots and visual checks, but it is not an Agent Runtime.

## Slash Commands

Slash commands are parsed outside the CLI reducer:

- `/help` toggles command help.
- `/clear` clears rendered messages, tools, images, and errors.
- `/debug` toggles event count, last event type, running tools, and terminal width in the status bar.
- `/exit` unmounts the Ink UI.
- `/model`, `/mcp`, `/agent`, and `/tool` emit runtime command intents for a future Agent Runtime.

Non-command input is emitted through `onUserInput`.

## Public API

```ts
import {renderCli} from "./apps/cli/src/cli/index.js";

const cli = renderCli({title: "Pixelle"});

cli.onUserInput((input) => {
  console.log(input.content);
});

cli.onRuntimeCommand((command) => {
  console.log(command.raw);
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

## Events

The shared event bus lives in `packages/events`. It supports typed listeners, wildcard listeners, one-shot listeners, bounded history, replay, middleware, automatic `createdAt` completion, and clear:

```ts
eventBus.on("tool_start", handleToolStart);
eventBus.on("*", handleAnyEvent);
eventBus.once("error", handleFirstError);
eventBus.replay(handleAnyEvent, {limit: 20});
```

History is kept in memory only and defaults to the latest 200 events. CLI event payloads and view state types live in `apps/cli/src/cli/types.ts`; streaming assistant deltas are merged by the CLI reducer, not by the event bus.

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

