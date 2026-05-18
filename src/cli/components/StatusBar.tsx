import {Box, Text} from "ink";
import type {ToolCallState} from "../types/messages.js";

type StatusBarProps = {
  tools: ToolCallState[];
  width: number;
  lastError?: string;
};

export function StatusBar({tools, width, lastError}: StatusBarProps) {
  const runningTools = tools.filter((tool) => tool.status === "running").length;

  return (
    <Box borderStyle="single" borderColor={lastError ? "red" : "gray"} paddingX={1}>
      <Text color={lastError ? "red" : "gray"}>
        width {width} | tools running {runningTools}
        {lastError ? ` | ${lastError}` : ""}
      </Text>
    </Box>
  );
}
