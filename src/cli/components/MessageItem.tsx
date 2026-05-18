import {Box, Text} from "ink";
import type {CliMessage} from "../types/messages.js";
import {MarkdownRenderer} from "./MarkdownRenderer.js";
import {StreamMessage} from "./StreamMessage.js";

type MessageItemProps = {
  message: CliMessage;
};

export function MessageItem({message}: MessageItemProps) {
  const label = getLabel(message.role);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={label.color} bold>
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
      return {text: "You", color: "green"};
    case "assistant":
      return {text: "Pixelle", color: "blue"};
    case "error":
      return {text: "Error", color: "red"};
  }
}
