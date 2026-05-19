import {Box, Text} from "ink";
import {icons, theme} from "../../utils/theme.js";
import {useTerminalPulse} from "../motion/useTerminalPulse.js";
import {MarkdownRenderer} from "../markdown/MarkdownRenderer.js";

type StreamMessageProps = {
  content: string;
  streaming?: boolean;
};

export function StreamMessage({content, streaming}: StreamMessageProps) {
  const cursorFrame = useTerminalPulse(
    icons.cursorFrames.length,
    180,
    Boolean(streaming),
  );

  return (
    <Box flexDirection="column">
      <MarkdownRenderer content={content} />
      {streaming ? (
        <Text color={theme.muted}>{icons.cursorFrames[cursorFrame]}</Text>
      ) : null}
    </Box>
  );
}
