import {Box, Text} from "ink";
import {icons, theme} from "../../utils/theme.js";
import {MarkdownRenderer} from "../markdown/MarkdownRenderer.js";

type StreamMessageProps = {
  content: string;
  streaming?: boolean;
};

export function StreamMessage({content, streaming}: StreamMessageProps) {
  return (
    <Box flexDirection="column">
      <MarkdownRenderer content={content} />
      {streaming ? (
        <Text color={theme.muted}>{icons.cursor}</Text>
      ) : null}
    </Box>
  );
}
