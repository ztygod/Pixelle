import {Box, Text} from "ink";
import {theme} from "../../utils/theme.js";

type CodeBlockProps = {
  code: string;
  language?: string;
  reveal?: boolean;
};

export function CodeBlock({code, language, reveal = false}: CodeBlockProps) {
  const lines = code.length === 0 ? [""] : code.split("\n");
  const isDiff = language === "diff" || language === "patch";
  const title = isDiff ? "diff" : "code";

  return (
    <Box flexDirection="column" marginY={1}>
      <Text>
        <Text color={isDiff ? theme.accent : theme.muted}>{title}</Text>
        {language ? <Text color={theme.muted}> / {language}</Text> : null}
        {reveal ? <Text color={theme.faint}> / streaming</Text> : null}
      </Text>
      {lines.map((line, index) => (
        <Text key={`${index}:${line}`}>
          <Text color={getGutterColor(line, isDiff)}>│ </Text>
          <Text color={getLineColor(line, isDiff)}>
            {line.length === 0 ? " " : line}
          </Text>
        </Text>
      ))}
    </Box>
  );
}

function getGutterColor(line: string, isDiff: boolean): string {
  if (!isDiff) {
    return theme.rail;
  }

  if (line.startsWith("+")) {
    return theme.success;
  }

  if (line.startsWith("-")) {
    return theme.danger;
  }

  if (line.startsWith("@@")) {
    return theme.accent;
  }

  return theme.rail;
}

function getLineColor(line: string, isDiff: boolean): string | undefined {
  if (!isDiff) {
    return theme.code;
  }

  if (line.startsWith("+")) {
    return theme.success;
  }

  if (line.startsWith("-")) {
    return theme.danger;
  }

  if (line.startsWith("@@")) {
    return theme.accent;
  }

  return theme.text;
}
