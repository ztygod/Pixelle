import {Box, Text} from "ink";
import type {CliViewState} from "../../state/cli-state.js";
import {theme} from "../../utils/theme.js";

type StatusBarProps = {
  title: string;
  state: CliViewState;
  width: number;
};

export function StatusBar({title, state, width}: StatusBarProps) {
  const isThinking = state.messages.some((message) => message.streaming);
  const runningTools = state.tools.filter(
    (tool) => tool.status === "pending" || tool.status === "running",
  ).length;
  const errorTools = state.tools.filter((tool) => tool.status === "error").length;
  const statusLabel = state.lastError
    ? "Error"
    : runningTools > 0
      ? "Working"
      : isThinking
        ? "Thinking"
        : "Ready";
  const toolsLabel =
    runningTools > 0
      ? `${runningTools} running`
      : errorTools > 0
        ? `${errorTools} error`
        : "idle";
  const lastEvent = state.lastEventType ?? "none";
  const compact = width < 72;

  return (
    <Box marginTop={1}>
      <Text color={state.lastError ? theme.danger : theme.muted}>
        <Text color={theme.primary}>{title}</Text>
        <Text color={theme.muted}> </Text>
        <Text color={getStatusColor(statusLabel)}>{statusLabel}</Text>
        <Text
          color={
            runningTools > 0
              ? theme.accent
              : errorTools > 0
                ? theme.danger
                : theme.success
          }
        >
          {" "}
          tools {toolsLabel}
        </Text>
        {state.debug ? <Text color={theme.muted}> events {state.eventCount}</Text> : null}
        {state.debug && !compact ? <Text color={theme.muted}> width {width}</Text> : null}
        {state.debug ? <Text color={theme.muted}> last {lastEvent}</Text> : null}
        <Text color={theme.faint}> /help</Text>
      </Text>
    </Box>
  );
}

function getStatusColor(status: string): string {
  switch (status) {
    case "Ready":
      return theme.success;
    case "Thinking":
    case "Working":
      return theme.accent;
    case "Error":
      return theme.danger;
    default:
      return theme.muted;
  }
}
