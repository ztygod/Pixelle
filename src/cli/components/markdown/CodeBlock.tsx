import {Box, Text} from "ink";
import {theme} from "../../utils/theme.js";

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({code, language}: CodeBlockProps) {
  const lines = code.length === 0 ? [""] : code.split("\n");
  const isDiff = language === "diff" || language === "patch";

  return (
    <Box flexDirection="column" marginY={1}>
      {language ? (
        <Text color={theme.muted}>code / {language}</Text>
      ) : (
        <Text color={theme.muted}>code</Text>
      )}
      {lines.map((line, index) => (
        <Text key={`${index}:${line}`}>
          <Text color={theme.rail}>│ </Text>
          <Text color={getLineColor(line, isDiff)}>
            {line.length === 0 ? " " : line}
          </Text>
        </Text>
      ))}
    </Box>
  );
}

function getLineColor(line: string, isDiff: boolean): string | undefined {
  if (!isDiff) {
    return undefined;
  }

  if (line.startsWith("+")) {
    return theme.success;
  }

  if (line.startsWith("-")) {
    return theme.danger;
  }

  if (line.startsWith("@@")) {
    return theme.muted;
  }

  return undefined;
}
