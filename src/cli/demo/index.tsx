import {renderCli} from "../render-cli.js";
import {startDemoRuntime} from "./demo-runtime.js";

const cli = renderCli({title: "Pixelle CLI Demo"});
const stopDemoRuntime = startDemoRuntime(cli);

function shutdown(): void {
  stopDemoRuntime();
  cli.unmount();
}

cli.onUserInput((input) => {
  if (input.content === "/exit") {
    shutdown();
    process.exitCode = 0;
    return;
  }

  cli.pushEvent({
    type: "user_message",
    content: input.content,
    createdAt: input.createdAt,
  });

  const messageId = `demo_reply_${input.createdAt}`;
  cli.pushEvent({
    type: "assistant_delta",
    messageId,
    delta:
      "Demo runtime only: CLI captured this input and emitted it through `onUserInput`; no agent is attached.",
  });
  cli.pushEvent({type: "assistant_done", messageId});
});

process.once("SIGINT", () => {
  shutdown();
  process.exitCode = 130;
});
