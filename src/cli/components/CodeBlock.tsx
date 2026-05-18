import {Box, Text} from "ink";

type CodeBlockProps = {
  code: string;
  language?: string;
};

export function CodeBlock({code, language}: CodeBlockProps) {
  const lines = code.length === 0 ? [""] : code.split("\n");
  const isDiff = language === "diff" || language === "patch";

  return (
    <Box flexDirection="column" marginY={1}>
      {language ? <Text color="gray">```{language}</Text> : null}
      {lines.map((line, index) => (
        <Text key={`${index}:${line}`} color={getLineColor(line, isDiff)}>
          {line.length === 0 ? " " : line}
        </Text>
      ))}
      {language ? <Text color="gray">```</Text> : null}
    </Box>
  );
}

function getLineColor(line: string, isDiff: boolean): string | undefined {
  if (!isDiff) {
    return "cyan";
  }

  if (line.startsWith("+")) {
    return "green";
  }

  if (line.startsWith("-")) {
    return "red";
  }

  if (line.startsWith("@@")) {
    return "gray";
  }

  return undefined;
}
