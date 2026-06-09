# Pixelle Agent CLI

`src/cli` is the terminal presentation layer for `@pixelle/agent`. It renders an event stream, captures user input, and exposes a small API that runtime code or debug tools can drive.

The CLI does not call models, run agents, execute tools, scan files, write files, start servers, or orchestrate runtime decisions. Runtime-facing commands emit intent events that callers can subscribe to through the CLI handle.

`src/cli/index.ts` is the side-effect-free public API entry for the `@pixelle/agent/cli` export. The executable entry lives in `src/cli.ts` and is published as `pixelle-agent`.

## Public API

```ts
import {renderCli} from "@pixelle/agent/cli";

const cli = renderCli({title: "Pixelle Agent"});

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

## Runtime Boundary

- Runtime code must not import `src/cli`.
- CLI code may import Runtime event types and event bus utilities.
- CLI state is in memory only and defaults to the latest 200 events.
