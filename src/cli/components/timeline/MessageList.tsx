import {Box, Text} from "ink";
import type {CliMessage} from "../../types.js";
import {MessageItem} from "./MessageItem.js";

type MessageListProps = {
  messages: CliMessage[];
  width: number;
};

export function MessageList({messages, width}: MessageListProps) {
  if (messages.length === 0) {
    return <Text color="gray"> </Text>;
  }

  return (
    <Box flexDirection="column">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} width={width} />
      ))}
    </Box>
  );
}
