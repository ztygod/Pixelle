import {Box, Text} from "ink";
import wrapAnsi from "wrap-ansi";

import {theme} from "../../utils/theme.js";

type DiffPreviewProps = {
  diff: string;
  maxLines?: number;
  showLineNumbers?: boolean;
  width?: number;
};

type ParsedDiffLine = {
  kind: "add" | "delete" | "context" | "hunk" | "file" | "meta";
  text: string;
  oldLine?: number;
  newLine?: number;
};

const DEFAULT_MAX_LINES = 120;

export function DiffPreview({
  diff,
  maxLines = DEFAULT_MAX_LINES,
  showLineNumbers = true,
  width = 100,
}: DiffPreviewProps) {
  const lines = parseUnifiedDiff(diff);

  if (!lines.length) {
    return (
      <Box marginTop={1} paddingLeft={1}>
        <Text color={theme.faint}>no diff available</Text>
      </Box>
    );
  }

  const visibleLines = lines.slice(0, maxLines);
  const truncated = lines.length > maxLines;
  const maxOldLine = Math.max(0, ...visibleLines.map((line) => line.oldLine ?? 0));
  const maxNewLine = Math.max(0, ...visibleLines.map((line) => line.newLine ?? 0));
  const lineNumberWidth = Math.max(2, String(Math.max(maxOldLine, maxNewLine)).length);
  const gutterWidth = showLineNumbers ? lineNumberWidth + 4 : 2;
  const contentWidth = Math.max(20, width - gutterWidth - 2);

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={1}>
      {visibleLines.map((line, index) => (
        <DiffLine
          key={`${index}:${line.text}`}
          line={line}
          contentWidth={contentWidth}
          lineNumberWidth={lineNumberWidth}
          showLineNumbers={showLineNumbers}
        />
      ))}
      {truncated ? (
        <Text color={theme.faint}>
          {`... diff truncated, showing first ${maxLines} lines`}
        </Text>
      ) : null}
    </Box>
  );
}

function DiffLine({
  line,
  contentWidth,
  lineNumberWidth,
  showLineNumbers,
}: {
  line: ParsedDiffLine;
  contentWidth: number;
  lineNumberWidth: number;
  showLineNumbers: boolean;
}) {
  const color = getLineColor(line.kind);
  const marker = getMarker(line.kind);
  const text = line.text || " ";
  const wrapped = wrapAnsi(text, contentWidth, {hard: true}).split("\n");

  return (
    <>
      {wrapped.map((part, index) => (
        <Text key={`${index}:${part}`} color={color}>
          {index === 0 ? (
            <DiffGutter
              line={line}
              lineNumberWidth={lineNumberWidth}
              marker={marker}
              showLineNumbers={showLineNumbers}
            />
          ) : (
            <Text color={theme.rail}>
              {" ".repeat(showLineNumbers ? lineNumberWidth + 4 : 2)}
            </Text>
          )}
          {part}
        </Text>
      ))}
    </>
  );
}

function DiffGutter({
  line,
  lineNumberWidth,
  marker,
  showLineNumbers,
}: {
  line: ParsedDiffLine;
  lineNumberWidth: number;
  marker: string;
  showLineNumbers: boolean;
}) {
  if (!showLineNumbers || line.kind === "hunk" || line.kind === "file") {
    return <Text color={theme.rail}>{`${marker} `}</Text>;
  }

  const number = line.kind === "add" ? line.newLine : (line.oldLine ?? line.newLine);
  const lineNumber = number === undefined ? "" : String(number);

  return (
    <Text color={theme.rail}>
      {lineNumber.padStart(lineNumberWidth, " ")} {marker}{" "}
    </Text>
  );
}

function parseUnifiedDiff(diff: string): ParsedDiffLine[] {
  const lines = diff.replace(/\s+$/g, "").split(/\r?\n/);
  const parsed: ParsedDiffLine[] = [];
  let oldLine: number | undefined;
  let newLine: number | undefined;

  for (const rawLine of lines) {
    const hunk = rawLine.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      parsed.push({kind: "hunk", text: rawLine});
      continue;
    }

    if (rawLine.startsWith("---") || rawLine.startsWith("+++")) {
      parsed.push({kind: "file", text: rawLine});
      continue;
    }

    if (rawLine.startsWith("+")) {
      parsed.push({kind: "add", text: rawLine, newLine});
      newLine = incrementLine(newLine);
      continue;
    }

    if (rawLine.startsWith("-")) {
      parsed.push({kind: "delete", text: rawLine, oldLine});
      oldLine = incrementLine(oldLine);
      continue;
    }

    if (rawLine.startsWith(" ")) {
      parsed.push({kind: "context", text: rawLine, oldLine, newLine});
      oldLine = incrementLine(oldLine);
      newLine = incrementLine(newLine);
      continue;
    }

    parsed.push({kind: "meta", text: rawLine});
  }

  return parsed.filter((line) => line.text.length > 0);
}

function incrementLine(line: number | undefined): number | undefined {
  return line === undefined ? undefined : line + 1;
}

function getMarker(kind: ParsedDiffLine["kind"]): string {
  switch (kind) {
    case "add":
      return "+";
    case "delete":
      return "-";
    case "hunk":
      return ">";
    default:
      return "│";
  }
}

function getLineColor(kind: ParsedDiffLine["kind"]): string {
  switch (kind) {
    case "add":
      return theme.success;
    case "delete":
      return theme.danger;
    case "hunk":
      return theme.accent;
    case "file":
    case "meta":
      return theme.faint;
    case "context":
      return theme.muted;
  }
}
