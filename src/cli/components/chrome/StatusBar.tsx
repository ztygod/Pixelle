import {Box, Text} from "ink";
import type {CliViewState} from "../../state/cli-state.js";
import {theme} from "../../utils/theme.js";

type StatusBarProps = {
  title: string;
  state: CliViewState;
  width: number;
};

export function StatusBar({title, state, width}: StatusBarProps) {
  const runningTools = state.tools.filter((tool) => tool.status === "running").length;

  return (
    <Box marginTop={1}>
      <Text color={state.lastError ? theme.danger : theme.muted}>
        {title} / ui only / {runningTools} tools running · /help
        {state.debug
          ? ` / events ${state.eventCount} / last ${state.lastEventType ?? "none"} / width ${width}`
          : ""}
      </Text>
    </Box>
  );
}
