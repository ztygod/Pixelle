import path from "node:path";

import {createAgentRuntime, type Agent} from "../../agent/index.js";
import {
  assertWorkspaceDirectory,
  loadLocalCliConfig,
  localCliConfigToAgentConfig,
  saveLocalCliConfig,
  type LocalCliConfig,
} from "../../config/local-cli-config.js";
import {agentEventToCliEvent} from "../runtime-events.js";
import {renderCli, type CliEvent, type CliHandle} from "../index.js";
import {runLocalCliSetup} from "./setup.js";

type PendingEdit = {
  prompt: string;
};

export async function runLocalCli(options: {reconfigure?: boolean} = {}): Promise<void> {
  let config = await ensureConfig(options.reconfigure);
  let agent = createAgent(config);
  let cli: CliHandle | undefined;
  let running = false;
  let pendingEdit: PendingEdit | undefined;

  const render = (initialEvents: CliEvent[] = []): void => {
    cli = renderCli({
      title: "Pixelle Agent",
      cwd: config.workspaceDir,
      model: config.model,
      initialEvents,
    });

    cli.onUserInput((event) => {
      void handleUserInput(event.content).catch((error: unknown) => {
        emitError(
          error instanceof Error ? error.message : "Failed to handle input.",
          error,
        );
      });
    });
    cli.onRuntimeCommand((event) => {
      void handleRuntimeCommand(event.command, event.args).catch((error: unknown) => {
        emitError(
          error instanceof Error ? error.message : "Failed to handle command.",
          error,
        );
      });
    });
  };

  const emit = (event: CliEvent): void => {
    cli?.pushEvent(event);
  };

  const emitNotice = (content: string): void => {
    const messageId = createMessageId("notice");
    emit({
      type: "assistant_delta",
      messageId,
      delta: content,
      stage: "complete",
    });
    emit({type: "assistant_done", messageId});
  };

  const emitError = (message: string, detail?: unknown): void => {
    emit({type: "error", message, detail});
  };

  const rebuildAgent = (): void => {
    agent = createAgent(config);
  };

  const reconfigure = async (): Promise<void> => {
    if (running) {
      emitError("Cannot reconfigure while Pixelle is running.");
      return;
    }

    const previousConfig = config;
    cli?.unmount();
    try {
      config = await runLocalCliSetup(config);
      await saveLocalCliConfig(config);
      rebuildAgent();
      render(noticeEvents("Configuration updated."));
    } catch (error) {
      config = previousConfig;
      rebuildAgent();
      render([
        ...noticeEvents("Configuration was not changed."),
        {
          type: "error",
          message: error instanceof Error ? error.message : "Configuration failed.",
          detail: error,
        },
      ]);
    }
  };

  const setWorkspace = async (args: readonly string[]): Promise<void> => {
    if (!args.length) {
      emitNotice(`Current workspace: ${config.workspaceDir}`);
      return;
    }

    if (running) {
      emitError("Cannot change workspace while Pixelle is running.");
      return;
    }

    const workspaceDir = await assertWorkspaceDirectory(path.resolve(args.join(" ")));
    config = {
      ...config,
      workspaceDir,
    };
    await saveLocalCliConfig(config);
    rebuildAgent();
    emitNotice(`Workspace set to ${workspaceDir}`);
  };

  const handleRuntimeCommand = async (
    command: string,
    args: readonly string[],
  ): Promise<void> => {
    switch (command) {
      case "config":
        await reconfigure();
        return;
      case "workspace":
        await setWorkspace(args);
        return;
      case "edit": {
        const prompt = args.join(" ").trim();
        if (!prompt) {
          emitError("Usage: /edit <request>");
          return;
        }
        if (running) {
          emitError("Pixelle is already running. Wait for the current task to finish.");
          return;
        }
        pendingEdit = {prompt};
        emitNotice(
          `Allow Pixelle to create or modify files in this workspace for this request?\n\n${prompt}\n\nType y to continue, or n to cancel.`,
        );
        return;
      }
      default:
        emitError(`Unknown command: /${command}`);
    }
  };

  const handleUserInput = async (content: string): Promise<void> => {
    if (pendingEdit) {
      const answer = content.trim().toLowerCase();
      if (["y", "yes"].includes(answer)) {
        const prompt = pendingEdit.prompt;
        pendingEdit = undefined;
        await runAgent(prompt, "edit");
        return;
      }
      if (["n", "no"].includes(answer)) {
        pendingEdit = undefined;
        emitNotice("Edit request cancelled.");
        return;
      }

      emitNotice("Type y to allow this edit, or n to cancel.");
      return;
    }

    await runAgent(content, "ask");
  };

  const runAgent = async (prompt: string, mode: "ask" | "edit"): Promise<void> => {
    if (running) {
      emitError("Pixelle is already running. Wait for the current task to finish.");
      return;
    }

    running = true;
    try {
      for await (const event of agent.stream({
        prompt,
        mode,
        permissions: {
          readFile: true,
          writeFile: mode === "edit",
          shell: false,
          network: false,
        },
      })) {
        const cliEvent = agentEventToCliEvent(event);
        if (cliEvent) {
          emit(cliEvent);
        }
      }
    } catch (error) {
      emitError(error instanceof Error ? error.message : "Agent run failed.", error);
    } finally {
      running = false;
    }
  };

  render(noticeEvents(`Loaded workspace: ${config.workspaceDir}`));
}

async function ensureConfig(reconfigure = false): Promise<LocalCliConfig> {
  const existing = await loadLocalCliConfig();
  if (existing && !reconfigure) {
    return existing;
  }

  const config = await runLocalCliSetup(existing);
  await saveLocalCliConfig(config);
  return config;
}

function createAgent(config: LocalCliConfig): Agent {
  return createAgentRuntime(localCliConfigToAgentConfig(config));
}

function noticeEvents(content: string): CliEvent[] {
  const messageId = createMessageId("notice");
  return [
    {
      type: "assistant_delta",
      messageId,
      delta: content,
      stage: "complete",
    },
    {type: "assistant_done", messageId},
  ];
}

function createMessageId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
