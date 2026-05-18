import {Box, Text} from "ink";
import {theme} from "../utils/theme.js";

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({code, language}: CodeBlockProps) {
  const lines = code.length === 0 ? [""] : code.split("\n");
  const isDiff = language === "diff" || language === "patch";

  return (
    <Box
      borderStyle="single"
      borderColor={theme.border}
      flexDirection="column"
      marginY={1}
      paddingX={1}
    >
      {language ? <Text color={theme.muted}>{language}</Text> : null}
      {lines.map((line, index) => (
        <Text key={`${index}:${line}`} color={getLineColor(line, isDiff)}>
          {line.length === 0 ? " " : line}
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
