import {Box, Text} from "ink";
import type {CliMessage} from "../events/types.js";
import {icons, theme} from "../utils/theme.js";
import {MarkdownRenderer} from "./MarkdownRenderer.js";
import {StreamMessage} from "./StreamMessage.js";

type MessageItemProps = {
  message: CliMessage;
};

export function MessageItem({message}: MessageItemProps) {
  const label = getLabel(message.role);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={label.color}>
        {label.text}
      </Text>
      <Box paddingLeft={2} flexDirection="column">
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
      return {text: icons.user, color: theme.muted};
    case "assistant":
      return {text: `${icons.assistant} Pixelle`, color: theme.primary};
    case "error":
      return {text: "Error", color: theme.danger};
  }
}
