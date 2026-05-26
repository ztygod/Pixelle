import { Box } from "ink";
import type { CliViewState } from "../state/cli-state.js";
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
  onSubmit(input: string): void;
  width: number;
};

export function Layout({
  title,
  version,
  cwd,
  state,
  onSubmit,
  width,
}: LayoutProps) {
  const timelineItems = selectTimelineItems(state);

  return (
    <Box flexDirection="column">
      <WelcomeScreen
        version={version}
        cwd={cwd}
        model="gpt-5.5"
        gitBranch="feat/cli-header"
        gitStatus="modified"
      />
      <Timeline items={timelineItems} showHelp={state.showHelp} />
      <StatusBar title={title} state={state} width={width} />
      <InputBox
        onSubmit={onSubmit}
        width={width}
      />
    </Box>
  );
}
