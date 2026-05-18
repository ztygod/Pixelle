import {Box, Text} from "ink";
import {MarkdownRenderer} from "./MarkdownRenderer.js";

type StreamMessageProps = {
  content: string;
  streaming?: boolean;
};

export function StreamMessage({content, streaming}: StreamMessageProps) {
  return (
    <Box flexDirection="column">
      <MarkdownRenderer content={content} />
      {streaming ? <Text color="gray">...</Text> : null}
    </Box>
  );
}
