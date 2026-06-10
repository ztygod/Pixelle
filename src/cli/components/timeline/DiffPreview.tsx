import {Box, Text} from "ink";

import type {ChangedFileState} from "../../types.js";
import {createFileDiff} from "../../utils/diff.js";
import {theme} from "../../utils/theme.js";

type DiffPreviewProps = {
  file: ChangedFileState;
};

export function DiffPreview({file}: DiffPreviewProps) {
  const diff = createFileDiff(file);

  if (!diff) {
    return null;
  }

  return (
    <Box flexDirection="column" marginTop={1} paddingLeft={1}>
      {diff.split("\n").map((line, index) => (
        <Text key={`${index}:${line}`} color={getLineColor(line)}>
          {line}
        </Text>
      ))}
    </Box>
  );
}

function getLineColor(line: string): string {
  if (line.startsWith("+") && !line.startsWith("+++")) {
    return theme.success;
  }

  if (line.startsWith("-") && !line.startsWith("---")) {
    return theme.danger;
  }

  if (line.startsWith("@@")) {
    return theme.accent;
  }

  return theme.muted;
}
