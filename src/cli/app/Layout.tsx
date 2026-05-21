import { Box } from "ink";
import type { UserInputBus } from "../types.js";
import type { CliCommand, CliViewState } from "../state/cli-state.js";
import { InputBox } from "../components/chrome/InputBox.js";
import { StatusBar } from "../components/chrome/StatusBar.js";
import { Timeline } from "../components/timeline/Timeline.js";
import { selectTimelineItems } from "../state/timeline.js";
import { WelcomeScreen } from "../components/chrome/WelcomeScreen.js";

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
  const timelineItems = selectTimelineItems(state);

  return (
    <Box flexDirection="column">
      <WelcomeScreen
        version="0.1.0"
        cwd={process.cwd()}
        model="gpt-5.5"
        gitBranch="feat/cli-header"
        gitStatus="modified"
      />
      <Timeline items={timelineItems} showHelp={state.showHelp} />
      <StatusBar title={title} state={state} width={width} />
      <InputBox
        userInputBus={userInputBus}
        runCommand={runCommand}
        width={width}
        onExit={onExit}
      />
    </Box>
  );
}
