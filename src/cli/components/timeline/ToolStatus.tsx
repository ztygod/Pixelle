import {Box, Text} from "ink";
import type {ToolCallState} from "../../types.js";
import {formatUnknown, hasLongDetail} from "../../utils/format.js";
import {icons, theme} from "../../utils/theme.js";

type ToolStatusProps = {
  tool: ToolCallState;
  debug: boolean;
};

export function ToolStatus({tool, debug}: ToolStatusProps) {
  const color = getColor(tool.status);
  const icon = getIcon(tool.status);
  const detail = getInlineDetail(tool);
  const expanded =
    debug &&
    (hasLongDetail(tool.input) ||
      hasLongDetail(tool.output) ||
      hasLongDetail(tool.error));

  return (
    <Box
      borderStyle="round"
      borderColor={tool.status === "error" ? theme.danger : theme.border}
      flexDirection="column"
      marginBottom={1}
      paddingX={1}
      paddingY={1}
    >
      <Text>
        <Text color={color}>{icon}</Text>{" "}
        <Text color={theme.text}>{formatToolName(tool.name)}</Text>
        <Text color={theme.muted}> · {formatStatus(tool.status)}</Text>
        {formatDuration(tool) ? (
          <Text color={theme.faint}> · {formatDuration(tool)}</Text>
        ) : null}
        {detail ? <Text color={theme.muted}> · {detail}</Text> : null}
      </Text>
      {expanded ? (
        <Box flexDirection="column" marginLeft={1} marginTop={1}>
          {tool.input !== undefined ? (
            <Text color={theme.muted}>input {formatUnknown(tool.input, 500)}</Text>
          ) : null}
          {tool.output !== undefined ? (
            <Text color={theme.muted}>output {formatUnknown(tool.output, 500)}</Text>
          ) : null}
          {tool.error ? <Text color={theme.danger}>error {tool.error}</Text> : null}
        </Box>
      ) : null}
    </Box>
  );
}

function getInlineDetail(tool: ToolCallState): string {
  const target = getToolTarget(tool.input);

  if (tool.status === "pending") {
    return target ?? tool.description ?? "Queued";
  }

  if (tool.status === "running") {
    return target ?? tool.description ?? "Running...";
  }

  if (tool.status === "success" || tool.status === "done") {
    return target ?? tool.summary ?? formatUnknown(tool.output ?? "done", 80);
  }

  return tool.error ?? "Failed";
}

function getToolTarget(input: unknown): string | undefined {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  for (const key of ["path", "pattern", "command", "url"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }

  return undefined;
}

function formatToolName(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getIcon(status: ToolCallState["status"]): string {
  switch (status) {
    case "pending":
      return icons.running;
    case "running":
      return icons.running;
    case "success":
    case "done":
      return icons.done;
    case "error":
      return icons.error;
  }
}

function getColor(status: ToolCallState["status"]): string {
  switch (status) {
    case "pending":
      return theme.muted;
    case "running":
      return theme.accent;
    case "success":
    case "done":
      return theme.success;
    case "error":
      return theme.danger;
  }
}

function formatStatus(status: ToolCallState["status"]): string {
  return status === "done" ? "success" : status;
}

function formatDuration(tool: ToolCallState): string | undefined {
  if (tool.durationMs !== undefined) {
    return `${tool.durationMs}ms`;
  }

  if (tool.status === "running" && tool.startedAt) {
    return "running";
  }

  return undefined;
}
