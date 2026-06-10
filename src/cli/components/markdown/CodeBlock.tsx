import {Box, Text} from "ink";
import {highlight} from "cli-highlight";
import wrapAnsi from "wrap-ansi";
import {theme} from "../../utils/theme.js";

type CodeBlockProps = {
  code: string;
  language?: string;
  reveal?: boolean;
  closed?: boolean;
  width: number;
};

export function CodeBlock({
  code,
  language,
  reveal = false,
  closed = true,
  width,
}: CodeBlockProps) {
  const lines = code.length === 0 ? [""] : code.split("\n");
  const isDiff = language === "diff" || language === "patch";
  const title = language ?? (isDiff ? "diff" : "text");
  const contentWidth = Math.max(20, width - 6);

  return (
    <Box
      borderStyle="round"
      borderColor={isDiff ? theme.accent : theme.border}
      flexDirection="column"
      marginY={1}
      paddingX={1}
      width={Math.max(24, Math.min(width, 120))}
    >
      <Text>
        <Text color={isDiff ? theme.accent : theme.muted}>{title}</Text>
        {reveal || !closed ? <Text color={theme.faint}> / streaming</Text> : null}
      </Text>
      {lines.map((line, index) => (
        <CodeLine
          key={`${index}:${line}`}
          line={line}
          language={language}
          isDiff={isDiff}
          width={contentWidth}
        />
      ))}
    </Box>
  );
}

function CodeLine({
  line,
  language,
  isDiff,
  width,
}: {
  line: string;
  language?: string;
  isDiff: boolean;
  width: number;
}) {
  const renderedLine = line.length === 0 ? " " : line;
  const highlighted = isDiff ? renderedLine : highlightLine(renderedLine, language);
  const wrapped = wrapAnsi(highlighted, width, {hard: true}).split("\n");

  return (
    <>
      {wrapped.map((part, index) => (
        <Text key={`${index}:${part}`}>
          <Text color={index === 0 ? getGutterColor(line, isDiff) : theme.rail}>
            {index === 0 ? "│ " : "  "}
          </Text>
          {isDiff ? (
            <Text color={getLineColor(line, isDiff)}>{part}</Text>
          ) : (
            <Text>{part}</Text>
          )}
        </Text>
      ))}
    </>
  );
}

function highlightLine(line: string, language: string | undefined): string {
  if (!language) {
    return line;
  }

  try {
    return highlight(line, {language, ignoreIllegals: true});
  } catch {
    return line;
  }
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
