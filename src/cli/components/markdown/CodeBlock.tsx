import {useMemo} from "react";
import {Box, Text} from "ink";
import {highlight} from "cli-highlight";
import wrapAnsi from "wrap-ansi";
import {theme} from "../../utils/theme.js";
import {DiffPreview} from "../timeline/DiffPreview.js";

type CodeBlockProps = {
  code: string;
  language?: string;
  streaming?: boolean;
  closed?: boolean;
  width: number;
  maxLines?: number;
  showLineNumbers?: boolean;
};

export function CodeBlock({
  code,
  language,
  streaming = false,
  closed = true,
  width,
  maxLines = 160,
  showLineNumbers = true,
}: CodeBlockProps) {
  const lines = useMemo(() => splitCodeLines(code), [code]);
  const normalizedLanguage = normalizeCodeLanguage(language);
  const isDiff = normalizedLanguage === "diff" || normalizedLanguage === "patch";
  const visibleLines = useMemo(() => lines.slice(0, maxLines), [lines, maxLines]);
  const truncated = lines.length > maxLines;
  const title = formatLanguageLabel(normalizedLanguage);
  const blockWidth = Math.max(24, Math.min(width, 120));
  const lineNumberWidth = getLineNumberWidth(visibleLines.length);
  const gutterWidth = getGutterWidth(lineNumberWidth, showLineNumbers);
  const contentWidth = Math.max(12, blockWidth - gutterWidth - 4);
  const highlightedLines = useMemo(
    () =>
      isDiff
        ? []
        : visibleLines.map((line) =>
            highlightLine(line.length === 0 ? " " : line, normalizedLanguage),
          ),
    [isDiff, normalizedLanguage, visibleLines],
  );

  return (
    <Box flexDirection="column" marginY={1} paddingLeft={1} width={blockWidth}>
      <Text>
        <Text color={isDiff ? theme.accent : theme.muted}>{title}</Text>
        {streaming && !closed ? <Text color={theme.faint}> streaming</Text> : null}
      </Text>
      {isDiff ? (
        <DiffPreview
          diff={code}
          maxLines={maxLines}
          showLineNumbers={showLineNumbers}
          width={contentWidth}
        />
      ) : (
        <>
          {visibleLines.map((line, index) => (
            <CodeLine
              key={`${index}:${line}`}
              lineNumber={index + 1}
              lineNumberWidth={lineNumberWidth}
              highlighted={highlightedLines[index] ?? " "}
              width={contentWidth}
              showLineNumbers={showLineNumbers}
            />
          ))}
          {truncated ? (
            <Text color={theme.faint}>
              {`... code truncated, showing first ${maxLines} lines`}
            </Text>
          ) : null}
        </>
      )}
    </Box>
  );
}

function CodeLine({
  lineNumber,
  lineNumberWidth,
  highlighted,
  width,
  showLineNumbers,
}: {
  lineNumber: number;
  lineNumberWidth: number;
  highlighted: string;
  width: number;
  showLineNumbers: boolean;
}) {
  const wrapped = wrapAnsi(highlighted, width, {hard: true, trim: false}).split("\n");
  const continuationGutter = " ".repeat(getGutterWidth(lineNumberWidth, showLineNumbers));

  return (
    <>
      {wrapped.map((part, index) => (
        <Text key={`${index}:${part}`}>
          <Text color={theme.rail}>
            {index === 0
              ? formatGutter(lineNumber, lineNumberWidth, showLineNumbers)
              : continuationGutter}
          </Text>
          <Text>{part}</Text>
        </Text>
      ))}
    </>
  );
}

export function splitCodeLines(code: string): string[] {
  return code.length === 0 ? [""] : code.split(/\r?\n/);
}

export function normalizeCodeLanguage(language: string | undefined): string | undefined {
  const normalized = language?.trim().toLowerCase();
  return normalized || undefined;
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

export function getLineNumberWidth(lineCount: number): number {
  return Math.max(2, String(Math.max(1, lineCount)).length);
}

export function getGutterWidth(
  lineNumberWidth: number,
  showLineNumbers: boolean,
): number {
  return showLineNumbers ? lineNumberWidth + 3 : 2;
}

export function formatGutter(
  lineNumber: number,
  lineNumberWidth: number,
  showLineNumbers: boolean,
): string {
  return showLineNumbers
    ? `${String(lineNumber).padStart(lineNumberWidth, " ")} │ `
    : "│ ";
}

function formatLanguageLabel(language: string | undefined): string {
  switch (language) {
    case "ts":
      return "typescript";
    case "tsx":
      return "tsx";
    case "js":
      return "javascript";
    case "jsx":
      return "jsx";
    case "sh":
      return "shell";
    case "bash":
      return "bash";
    case "patch":
      return "patch";
    case "diff":
      return "diff";
    default:
      return language ?? "text";
  }
}
