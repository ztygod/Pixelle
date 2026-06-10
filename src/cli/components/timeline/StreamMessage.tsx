import {Box, Text} from "ink";
import {icons, theme} from "../../utils/theme.js";
import {MessageMarkdown} from "../markdown/MessageMarkdown.js";

type StreamMessageProps = {
  content: string;
  streaming?: boolean;
  width: number;
};

export function StreamMessage({content, streaming, width}: StreamMessageProps) {
  return (
    <Box flexDirection="column">
      <MessageMarkdown content={content} streaming={streaming} width={width} />
      {streaming ? <Text color={theme.muted}>{icons.cursor}</Text> : null}
    </Box>
  );
}
