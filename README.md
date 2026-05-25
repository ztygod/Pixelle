# Pixelle

[中文](./README.zh-CN.md)

Pixelle is a TypeScript and Ink based terminal interface project. The current repository focuses on the CLI presentation layer: it renders event streams, captures user input, and displays assistant messages, tool states, errors, Markdown, code blocks, diffs, and image preview fallbacks.

The Pixelle CLI layer does not call models, execute tools, scan or edit files, or orchestrate agent decisions. A separate runtime can drive the UI by pushing events through the public API and subscribing to user input and runtime command intents.

## Features

- Terminal UI rendering powered by Ink and React.
- Streaming assistant message display.
- Rendering for user messages, tool status, errors, image previews, and Markdown content.
- Slash command support: `/help`, `/clear`, `/debug`, `/exit`, `/model`, `/mcp`, `/agent`, and `/tool`.
- Shared event bus with typed listeners, wildcard listeners, once, replay, middleware, and bounded history.
- Demo runtime for screenshots, visual checks, and local interaction testing.

## Requirements

- Node.js
- pnpm

## Installation

```sh
pnpm install
```

## Commands

```sh
pnpm dev
pnpm build
pnpm start
pnpm cli:demo
```

- `pnpm dev`: start the standalone Pixelle CLI from source.
- `pnpm build`: compile TypeScript into `dist/`.
- `pnpm start`: run the compiled CLI entrypoint.
- `pnpm cli:demo`: start the built-in demo runtime with simulated events.

## API Usage

```ts
import {renderCli} from "./src/cli/index.js";

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

## Project Structure

```text
src/bin/        CLI executable entrypoint
src/cli/        Terminal presentation layer and public CLI API
src/commands/   Slash command parsing and dispatch
src/eventsbus/  Shared event bus
demos/          Local demo runtime
```

See `src/cli/README.md` for more details about the CLI internals.
