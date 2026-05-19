import {Box, Text} from "ink";
import type {CliMessage} from "../../types.js";
import {icons, theme} from "../../utils/theme.js";
import {MarkdownRenderer} from "../markdown/MarkdownRenderer.js";
import {StreamMessage} from "./StreamMessage.js";

type MessageItemProps = {
  message: CliMessage;
};

export function MessageItem({message}: MessageItemProps) {
  const label = getLabel(message.role);

  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Text>
        <Text color={label.color}>{label.text}</Text>
        {message.streaming ? <Text color={theme.muted}>  writing</Text> : null}
      </Text>
      <Box paddingLeft={message.role === "user" ? 0 : 1} flexDirection="column">
        {message.role === "assistant" ? (
          <StreamMessage content={message.content} streaming={message.streaming} />
        ) : message.role === "error" ? (
          <Text color="red">{message.content}</Text>
        ) : (
          <MarkdownRenderer content={message.content} />
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
