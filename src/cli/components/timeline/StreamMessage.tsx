import {Box, Text} from "ink";
import {icons, theme} from "../../utils/theme.js";
import {MarkdownRenderer} from "../markdown/MarkdownRenderer.js";

type StreamMessageProps = {
  content: string;
  streaming?: boolean;
  revealCode?: boolean;
};

export function StreamMessage({content, streaming, revealCode}: StreamMessageProps) {
  return (
    <Box flexDirection="column">
      <MarkdownRenderer content={content} revealCode={revealCode} />
      {streaming ? (
        <Text color={theme.muted}>{icons.cursor}</Text>
      ) : null}
    </Box>
  );
}
