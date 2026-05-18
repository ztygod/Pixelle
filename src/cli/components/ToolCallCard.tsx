import {Box, Text} from "ink";
import type {ToolCallState} from "../types/messages.js";

type ToolCallCardProps = {
  tool: ToolCallState;
};

export function ToolCallCard({tool}: ToolCallCardProps) {
  return (
    <Box borderStyle="round" borderColor={getBorderColor(tool.status)} paddingX={1} flexDirection="column">
      <Text>
        <Text bold>{tool.name}</Text> <Text color={getBorderColor(tool.status)}>{tool.status}</Text>
      </Text>
      {tool.input !== undefined ? <Text color="gray">input: {formatUnknown(tool.input)}</Text> : null}
      {tool.output !== undefined ? <Text color="gray">output: {formatUnknown(tool.output)}</Text> : null}
      {tool.error ? <Text color="red">error: {tool.error}</Text> : null}
    </Box>
  );
}

function getBorderColor(status: ToolCallState["status"]): string {
  switch (status) {
    case "running":
      return "yellow";
    case "done":
      return "green";
    case "error":
      return "red";
  }
}

function formatUnknown(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
