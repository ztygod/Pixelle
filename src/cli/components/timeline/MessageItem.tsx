import {Box, Text} from "ink";
import type {AgentStage, CliMessage} from "../../types.js";
import {icons, theme} from "../../utils/theme.js";
import {MarkdownRenderer} from "../markdown/MarkdownRenderer.js";
import {StreamMessage} from "./StreamMessage.js";

type MessageItemProps = {
  message: CliMessage;
  width: number;
};

export function MessageItem({message, width}: MessageItemProps) {
  const label = getLabel(message.role);
  const stage = message.role === "assistant" ? (message.stage ?? "thinking") : undefined;
  const stageMeta = stage ? getStageMeta(stage) : undefined;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text>
        <Text color={label.color}>{label.text}</Text>
        {stageMeta ? (
          <>
            <Text color={theme.muted}> / </Text>
            <Text color={stageMeta.color}>
              {stageMeta.icon} {stageMeta.label}
            </Text>
          </>
        ) : null}
        {message.streaming ? <Text color={theme.muted}> streaming</Text> : null}
      </Text>
      <Box flexDirection="column">
        {message.role === "assistant" ? (
          <StreamMessage
            content={message.content}
            streaming={message.streaming}
            width={width}
          />
        ) : message.role === "error" ? (
          <Text color="red">{message.content}</Text>
        ) : (
          <MarkdownRenderer content={message.content} width={width} />
        )}
      </Box>
    </Box>
  );
}

function getLabel(role: CliMessage["role"]): {text: string; color: string} {
  switch (role) {
    case "user":
      return {text: "you", color: theme.muted};
    case "assistant":
      return {text: "Pixelle", color: theme.brand};
    case "error":
      return {text: "error", color: theme.danger};
  }
}

function getStageMeta(stage: AgentStage): {
  label: string;
  color: string;
  icon: string;
} {
  switch (stage) {
    case "thinking":
      return {label: "thinking", color: theme.muted, icon: "·"};
    case "planning":
      return {label: "planning", color: theme.accent, icon: "◇"};
    case "executing":
      return {label: "executing", color: theme.primary, icon: "●"};
    case "complete":
      return {label: "complete", color: theme.success, icon: icons.done};
  }
}
