# Pixelle

[中文](./README.zh-CN.md)

Pixelle is evolving into a multi-entry AI Coding Workspace for frontend engineering. The current repository keeps the existing TypeScript and Ink CLI intact while adding the first monorepo skeleton for a Web workspace, a Server runtime backend, and shared packages.

The existing CLI presentation layer still renders event streams, captures user input, and displays assistant messages, tool states, errors, Markdown, code blocks, diffs, and image preview fallbacks.

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
pnpm dev:web
pnpm dev:server
pnpm build:workspace
pnpm typecheck
```

- `pnpm dev`: start the standalone Pixelle CLI from source.
- `pnpm build`: compile TypeScript into `dist/`.
- `pnpm start`: run the compiled CLI entrypoint.
- `pnpm cli:demo`: start the built-in demo runtime with simulated events.
- `pnpm dev:web`: start the Vite Web workspace.
- `pnpm dev:server`: start the Fastify runtime backend skeleton.
- `pnpm build:workspace`: build the shared packages, Web app, and Server app.
- `pnpm typecheck`: typecheck the workspace packages and apps.

## API Usage

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

## Project Structure

```text
apps/cli/       CLI executable entrypoint and terminal presentation layer
apps/web/       React Web workspace skeleton
apps/server/    Fastify Agent Runtime backend skeleton
packages/       Shared types, events, core contracts, sandbox, prompt, config
demos/          Local demo runtime
```

See `apps/cli/src/cli/README.md` for more details about the CLI internals.
