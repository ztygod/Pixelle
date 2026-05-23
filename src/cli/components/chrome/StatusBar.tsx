import {Box, Text} from "ink";
import type {CliViewState} from "../../state/cli-state.js";
import {theme} from "../../utils/theme.js";

type StatusBarProps = {
  title: string;
  state: CliViewState;
  width: number;
};

export function StatusBar({title, state, width}: StatusBarProps) {
  const runningTools = state.tools.filter(
    (tool) => tool.status === "pending" || tool.status === "running",
  ).length;
  const errorTools = state.tools.filter((tool) => tool.status === "error").length;
  const toolsLabel =
    runningTools > 0 ? `${runningTools} running` : errorTools > 0 ? `${errorTools} error` : "idle";
  const lastEvent = state.lastEventType ?? "none";
  const compact = width < 72;

  return (
    <Box marginTop={1}>
      <Text color={state.lastError ? theme.danger : theme.muted}>
        <Text color={theme.primary}>{title}</Text>
        <Text color={theme.muted}> mode demo</Text>
        <Text color={runningTools > 0 ? theme.accent : errorTools > 0 ? theme.danger : theme.success}>
          {" "}tools {toolsLabel}
        </Text>
        <Text color={theme.muted}> events {state.eventCount}</Text>
        {!compact ? <Text color={theme.muted}> width {width}</Text> : null}
        {!compact || state.debug ? <Text color={theme.muted}> last {lastEvent}</Text> : null}
        <Text color={theme.faint}> /help</Text>
      </Text>
    </Box>
  );
}
