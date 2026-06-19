import {Box, Text} from "ink";
import type {ToolCallState, ToolStreamState} from "../../types.js";
import {formatUnknown, hasLongDetail} from "../../utils/format.js";
import {theme} from "../../utils/theme.js";

type ToolStatusProps = {
  tool: ToolCallState;
  debug: boolean;
};

const MAX_PREVIEW_LINES = 20;
const MAX_PREVIEW_CHARS = 4000;

export function ToolStatus({tool, debug}: ToolStatusProps) {
  const expanded =
    debug &&
    (hasLongDetail(tool.input) ||
      hasLongDetail(tool.result) ||
      hasLongDetail(tool.output) ||
      hasLongDetail(tool.error));
  const preview = buildPreview(tool);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <ToolHeadline tool={tool} />
      {preview ? <PreviewBlock preview={preview} /> : null}
      {expanded ? (
        <Box flexDirection="column" marginLeft={2} marginTop={1}>
          {tool.input !== undefined ? (
            <Text color={theme.muted}>input {formatUnknown(tool.input, 500)}</Text>
          ) : null}
          {tool.output !== undefined ? (
            <Text color={theme.muted}>output {formatUnknown(tool.output, 500)}</Text>
          ) : null}
          {tool.result !== undefined ? (
            <Text color={theme.muted}>result {formatUnknown(tool.result, 500)}</Text>
          ) : null}
          {getPolicyDecision(tool) ? (
            <Text color={theme.muted}>
              policy {formatPolicyDecision(getPolicyDecision(tool))}
            </Text>
          ) : null}
          {tool.error ? <Text color={theme.danger}>error {tool.error}</Text> : null}
        </Box>
      ) : null}
    </Box>
  );
}

function ToolHeadline({tool}: {tool: ToolCallState}) {
  const title = getTitle(tool);
  const presentation = getToolPresentation(tool);

  if (tool.status === "pending" || tool.status === "running") {
    return (
      <Text>
        <ToolName tool={tool} />
        {title ? <Text color={theme.muted}> {title}</Text> : null}
      </Text>
    );
  }

  return (
    <Text>
      <ToolName tool={tool} />
      {title ? <Text color={theme.muted}> {title}</Text> : null}
      <Text color={theme.muted}> · </Text>
      <Text color={getColor(tool.status)}>
        {tool.status === "error" ? "failed" : "success"}
      </Text>
      {formatDuration(tool) ? (
        <>
          <Text color={theme.muted}> · </Text>
          <Text color={theme.faint}>{formatDuration(tool)}</Text>
        </>
      ) : null}
      {getTerminalSummary(tool) ? (
        <>
          <Text color={theme.muted}> · </Text>
          <Text color={presentation.detailColor}>{getTerminalSummary(tool)}</Text>
        </>
      ) : null}
    </Text>
  );
}

function ToolName({tool}: {tool: ToolCallState}) {
  const presentation = getToolPresentation(tool);

  return (
    <Text>
      <Text color={presentation.color}>{presentation.icon}</Text>{" "}
      <Text color={presentation.color} bold={presentation.bold}>
        {presentation.label}
      </Text>
    </Text>
  );
}

function PreviewBlock({preview}: {preview: PreviewText}) {
  return (
    <Box flexDirection="column" marginLeft={2} marginTop={1}>
      {preview.notice ? <Text color={theme.faint}>{preview.notice}</Text> : null}
      {preview.text.split(/\r?\n/).map((line, index) => (
        <Text
          key={`${index}:${line}`}
          color={preview.kind === "stderr" ? theme.danger : theme.muted}
        >
          {line || " "}
        </Text>
      ))}
    </Box>
  );
}

function getTitle(tool: ToolCallState): string | undefined {
  return (
    tool.result?.display?.target ??
    tool.display?.target ??
    tool.target ??
    tool.result?.display?.title ??
    tool.display?.title ??
    getToolTarget(tool.input) ??
    tool.description
  );
}

type ToolPresentation = {
  icon: string;
  label: string;
  color: string;
  detailColor: string;
  bold?: boolean;
};

function getToolPresentation(tool: ToolCallState): ToolPresentation {
  const presentations: Record<string, Omit<ToolPresentation, "label">> = {
    command: {
      icon: "▸",
      color: "yellow",
      detailColor: theme.faint,
      bold: true,
    },
    file: {
      icon: "▤",
      color: "cyan",
      detailColor: theme.muted,
    },
    search: {
      icon: "⌕",
      color: "magenta",
      detailColor: theme.muted,
      bold: true,
    },
    network: {
      icon: "◌",
      color: "blue",
      detailColor: theme.muted,
    },
    edit: {
      icon: "✎",
      color: "green",
      detailColor: theme.muted,
      bold: true,
    },
    list: {
      icon: "⌘",
      color: "gray",
      detailColor: theme.muted,
    },
    json: {
      icon: "◇",
      color: theme.accent,
      detailColor: theme.muted,
    },
    text: {
      icon: "◇",
      color: theme.accent,
      detailColor: theme.muted,
    },
  };
  const kind = tool.result?.display?.kind ?? tool.display?.kind;
  const presentation = kind ? presentations[kind] : undefined;
  const fallback = presentation ?? {
    icon: "◇",
    color: theme.accent,
    detailColor: theme.muted,
  };

  return {
    ...fallback,
    label: formatToolName(tool.name),
  };
}

function formatToolName(name: string): string {
  return name
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTerminalSummary(tool: ToolCallState): string | undefined {
  if (tool.status === "error") {
    const policyDecision = getPolicyDecision(tool);

    if (policyDecision) {
      return formatPolicyDecision(policyDecision);
    }

    return (
      tool.result?.display?.summary ??
      tool.display?.summary ??
      tool.result?.message ??
      tool.error ??
      tool.errorCode ??
      "Failed"
    );
  }

  return (
    tool.result?.display?.summary ??
    tool.display?.summary ??
    tool.result?.message ??
    tool.summary ??
    formatUnknown(tool.output ?? tool.result?.data ?? "done", 80)
  );
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

type PreviewText = {
  kind: ToolStreamState["type"] | "preview";
  text: string;
  notice?: string;
};

function buildPreview(tool: ToolCallState): PreviewText | undefined {
  const streamPreview = buildStreamPreview(tool);
  const display = tool.result?.display ?? tool.display;
  const fallbackText =
    tool.status === "error"
      ? streamPreview?.text || display?.preview
      : streamPreview?.text || display?.preview;

  if (!fallbackText) {
    return undefined;
  }

  const kind = streamPreview?.kind ?? "preview";
  const truncated = truncatePreview(fallbackText);
  const displayTruncated = display?.truncated && !truncated.notice;

  return {
    kind,
    text: truncated.text,
    notice:
      truncated.notice ??
      (displayTruncated
        ? `… output truncated, showing last ${MAX_PREVIEW_LINES} lines`
        : undefined),
  };
}

function buildStreamPreview(tool: ToolCallState): PreviewText | undefined {
  if (!tool.streams?.length) {
    return undefined;
  }

  const preferredType =
    tool.status === "error" && tool.streams.some((stream) => stream.type === "stderr")
      ? "stderr"
      : undefined;
  const streams = preferredType
    ? tool.streams.filter((stream) => stream.type === preferredType)
    : tool.streams;
  const text = streams
    .map((stream) => ("content" in stream ? (stream.content ?? "") : ""))
    .join("");

  if (!text) {
    return undefined;
  }

  return {
    kind: preferredType ?? "data",
    text,
  };
}

function truncatePreview(text: string): {text: string; notice?: string} {
  const normalized = text.replace(/\s+$/g, "");
  const lines = normalized.split(/\r?\n/);
  const tooManyLines = lines.length > MAX_PREVIEW_LINES;
  const tooManyChars = normalized.length > MAX_PREVIEW_CHARS;

  if (!tooManyLines && !tooManyChars) {
    return {text: normalized};
  }

  const lineLimited = lines.slice(-MAX_PREVIEW_LINES).join("\n");
  const textLimited =
    lineLimited.length > MAX_PREVIEW_CHARS
      ? lineLimited.slice(lineLimited.length - MAX_PREVIEW_CHARS)
      : lineLimited;

  return {
    text: textLimited,
    notice: `… output truncated, showing last ${MAX_PREVIEW_LINES} lines`,
  };
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

function formatDuration(tool: ToolCallState): string | undefined {
  if (tool.durationMs !== undefined) {
    return `${tool.durationMs}ms`;
  }

  if (tool.status === "running" && tool.startedAt) {
    return "running";
  }

  return undefined;
}

type PolicyDecisionView = {
  approvalMessage?: string;
  category?: string;
  effect?: string;
  reason?: string;
  risk?: string;
  ruleId?: string;
};

function getPolicyDecision(tool: ToolCallState): PolicyDecisionView | undefined {
  if (!tool.errorData || typeof tool.errorData !== "object") {
    return undefined;
  }

  const data = tool.errorData as Record<string, unknown>;
  const decision = data.decision;
  if (!decision || typeof decision !== "object") {
    return undefined;
  }

  return decision as PolicyDecisionView;
}

function formatPolicyDecision(decision: PolicyDecisionView | undefined): string {
  if (!decision) {
    return "";
  }

  const parts = [
    decision.approvalMessage,
    decision.risk ? `risk ${decision.risk}` : undefined,
    decision.category ? `category ${decision.category}` : undefined,
    decision.ruleId ? `rule ${decision.ruleId}` : undefined,
  ].filter((part): part is string => Boolean(part));

  return parts.length
    ? parts.join(" · ")
    : (decision.reason ?? decision.effect ?? "Policy blocked");
}
