#!/usr/bin/env node

import {
  createAgentRuntime,
  createInMemoryAgentSessionStore,
} from "@pixelle/agent";
import type {CommandIntent} from "@pixelle/agent";
import type {PixelleEvent} from "@pixelle/events";
import {pathToFileURL} from "node:url";
import {renderCli} from "../cli/index.js";
import {agentEventToCliEvent} from "../cli/runtime-events.js";

async function startStandaloneCli(): Promise<void> {
  const sessions = createInMemoryAgentSessionStore();
  const runtime = createAgentRuntime({sessionStore: sessions});
  const session = await runtime.createSession();
  const cli = renderCli({
    title: "Pixelle CLI",
  });
  const submitToRuntime = async (
    input:
      | {type: "user_message"; content: string}
      | {type: "command"; command: CommandIntent},
  ) => {
    const events: PixelleEvent[] = [];
    await runtime.submit(
      {
        ...input,
        sessionId: session.id,
      },
      {
        emit(event) {
          events.push(event);
          const cliEvent = agentEventToCliEvent(event);
          if (cliEvent) {
            cli.pushEvent(cliEvent);
          }
        },
      },
    );
    sessions.appendEvents(session.id, events);
  };

  cli.onUserInput((input) => {
    void submitToRuntime({type: "user_message", content: input.content});
  });

  cli.onRuntimeCommand((command) => {
    void submitToRuntime({
      type: "command",
      command: {
        raw: command.raw,
        name: command.command,
        args: command.args,
        scope: "runtime",
      },
    });
  });
}

const entrypoint = process.argv[1]
  ? pathToFileURL(process.argv[1]).href
  : undefined;

if (import.meta.url === entrypoint) {
  await startStandaloneCli();
}
