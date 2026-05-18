import {Box} from "ink";
import type {UserInputBus} from "../events/event-bus.js";
import type {CliCommand, CliViewState} from "../state/cli-state.js";
import {ErrorBlock} from "../components/ErrorBlock.js";
import {ImagePreview} from "../components/ImagePreview.js";
import {InputBox} from "../components/InputBox.js";
import {MessageList} from "../components/MessageList.js";
import {StatusBar} from "../components/StatusBar.js";
import {ToolStatus} from "../components/ToolStatus.js";
import {CommandHelp} from "./CommandHelp.js";
import {WelcomeScreen} from "./WelcomeScreen.js";

type LayoutProps = {
  title: string;
  version: string;
  cwd: string;
  state: CliViewState;
  userInputBus: UserInputBus;
  runCommand(input: string): CliCommand | undefined;
  width: number;
  onExit: () => void;
};

export function Layout({
  title,
  version,
  cwd,
  state,
  userInputBus,
  runCommand,
  width,
  onExit,
}: LayoutProps) {
  const hasContent =
    state.messages.length > 0 || state.tools.length > 0 || state.images.length > 0;
  const errorMessages = state.messages.filter((message) => message.role === "error");

  return (
    <Box flexDirection="column" paddingX={1}>
      <WelcomeScreen version={version} cwd={cwd} compact={hasContent} />
      {state.showHelp ? <CommandHelp /> : null}
      <MessageList messages={state.messages.filter((message) => message.role !== "error")} />
      {state.tools.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {state.tools.map((tool) => (
            <ToolStatus key={tool.id} tool={tool} />
          ))}
        </Box>
      ) : null}
      {state.images.length > 0 ? (
        <Box flexDirection="column" marginBottom={1}>
          {state.images.map((image) => (
            <ImagePreview key={image.id} image={image} />
          ))}
        </Box>
      ) : null}
      {errorMessages.map((message) => (
        <ErrorBlock key={message.id} message={message.content} />
      ))}
      <StatusBar title={title} state={state} width={width} />
      <InputBox
        userInputBus={userInputBus}
        runCommand={runCommand}
        onExit={onExit}
      />
    </Box>
  );
}

