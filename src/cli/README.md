# Pixelle CLI

`src/cli` is the terminal presentation layer for Pixelle. It renders events, captures user input, and exposes a small API for an external runtime to drive the UI.

## Responsibilities

The CLI layer owns:

- Terminal UI layout and Ink rendering.
- User input capture and outward dispatch.
- Markdown, code block, diff, and inline code rendering.
- Assistant streaming display.
- Tool call status cards.
- Local image preview fallback display.
- Error display.

The CLI layer does not own:

- Agent decisions.
- Model API calls.
- RAG, MCP, or runtime orchestration.
- Real tool execution.
- File reads or writes.

## Run the demo

```sh
pnpm cli:demo
```

The demo pushes simulated events into `renderCli()`. It is only a visual verification runtime, not an Agent Runtime. Type `/exit` to close the demo.

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

## CliEvent examples

```ts
cli.pushEvent({
  type: "user_message",
  content: "根据设计稿生成一个登录页",
});

cli.pushEvent({
  type: "tool_start",
  id: "tool_1",
  name: "list_files",
  input: {path: "src"},
});

cli.pushEvent({
  type: "tool_done",
  id: "tool_1",
  name: "list_files",
  output: "src/App.tsx\nsrc/main.tsx",
});

cli.pushEvent({
  type: "image_preview",
  path: "./assets/login-design.png",
  alt: "Login design reference",
});

cli.pushEvent({
  type: "error",
  message: "当前终端不支持直接渲染图片，已降级为路径展示。",
});
```

## Demo runtime boundary

`src/cli/demo/demo-runtime.ts` uses timers to push fake `CliEvent` objects into the CLI. It intentionally does not call models, inspect files, execute tools, or make decisions. Its only purpose is to verify the terminal experience.
