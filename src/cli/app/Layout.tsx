import {Box} from "ink";
import type {CliViewState} from "../state/cli-state.js";
import {InputBox} from "../components/chrome/InputBox.js";
import {StatusBar} from "../components/chrome/StatusBar.js";
import {Timeline} from "../components/timeline/Timeline.js";
import {selectTimelineItems} from "../state/timeline.js";
import {WelcomeScreen} from "../components/chrome/WelcomeScreen.js";

type LayoutProps = {
  title: string;
  version: string;
  cwd: string;
  model?: string;
  provider?: string;
  gitBranch?: string;
  gitStatus?: "clean" | "modified" | "unknown";
  state: CliViewState;
  onSubmit(input: string): void;
  width: number;
};

export function Layout({
  title,
  version,
  cwd,
  model,
  provider,
  gitBranch,
  gitStatus,
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
        model={model}
        provider={provider}
        gitBranch={gitBranch}
        gitStatus={gitStatus}
      />
      <Timeline items={timelineItems} showHelp={state.showHelp} debug={state.debug} />
      <StatusBar title={title} state={state} width={width} />
      <InputBox onSubmit={onSubmit} width={width} />
    </Box>
  );
}
