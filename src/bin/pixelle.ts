#!/usr/bin/env node

import {pathToFileURL} from "node:url";
import {renderCli} from "../cli/index.js";
import {createId} from "../cli/utils/format.js";

function startStandaloneCli(): void {
  const cli = renderCli({
    title: "Pixelle CLI",
  });

  cli.onUserInput((input) => {
    if (input.content === "/exit") {
      cli.unmount();
      process.exitCode = 0;
      return;
    }

    cli.pushEvent({
      type: "user_message",
      id: createId("local_user"),
      content: input.content,
      createdAt: input.createdAt,
    });

    const messageId = createId("local_assistant");
    cli.pushEvent({
      type: "assistant_delta",
      messageId,
      delta:
        "No runtime is attached. The CLI layer captured your input and exposed it through `onUserInput`.",
    });
    cli.pushEvent({type: "assistant_done", messageId});
  });
}

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (import.meta.url === entrypoint) {
  startStandaloneCli();
}
