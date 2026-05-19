import {Box, Text} from "ink";
import type {ToolCallState} from "../../types.js";
import {formatUnknown, hasLongDetail} from "../../utils/format.js";
import {icons, theme} from "../../utils/theme.js";
import {useTerminalPulse} from "../motion/useTerminalPulse.js";

type ToolStatusProps = {
  tool: ToolCallState;
};

export function ToolStatus({tool}: ToolStatusProps) {
  const color = getColor(tool.status);
  const pulseFrame = useTerminalPulse(
    icons.runningFrames.length,
    150,
    tool.status === "running",
  );
  const icon = getIcon(tool.status, pulseFrame);
  const detail = getInlineDetail(tool);
  const expanded =
    hasLongDetail(tool.input) || hasLongDetail(tool.output) || hasLongDetail(tool.error);

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Text>
        <Text color={color}>{icon}</Text>{" "}
        <Text color={theme.text}>{tool.name}</Text>
        {detail ? <Text color={theme.muted}> / {detail}</Text> : null}
      </Text>
      {expanded ? (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {tool.input !== undefined ? (
            <Text color={theme.muted}>input  {formatUnknown(tool.input, 500)}</Text>
          ) : null}
          {tool.output !== undefined ? (
            <Text color={theme.muted}>output {formatUnknown(tool.output, 500)}</Text>
          ) : null}
          {tool.error ? (
            <Text color={theme.danger}>error  {tool.error}</Text>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

function getInlineDetail(tool: ToolCallState): string {
  if (tool.status === "running") {
    return tool.description ?? "Running...";
  }

  if (tool.status === "done") {
    return tool.summary ?? formatUnknown(tool.output ?? "done", 80);
  }

  return tool.error ?? "Failed";
}

function getIcon(status: ToolCallState["status"], frame: number): string {
  switch (status) {
    case "running":
      return icons.runningFrames[frame];
    case "done":
      return icons.done;
    case "error":
      return icons.error;
  }
}

function getColor(status: ToolCallState["status"]): string {
  switch (status) {
    case "running":
      return theme.accent;
    case "done":
      return theme.success;
    case "error":
      return theme.danger;
  }
}

