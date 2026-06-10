import {Box, Text} from "ink";

import type {ChangeSetState, ChangedFileState} from "../../types.js";
import {theme} from "../../utils/theme.js";
import {DiffPreview} from "./DiffPreview.js";

type FileChangeCardProps = {
  changeSet: ChangeSetState;
  debug: boolean;
};

export function FileChangeCard({changeSet, debug}: FileChangeCardProps) {
  const counts = summarizeFiles(changeSet.files);

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border}
      flexDirection="column"
      marginBottom={1}
      paddingX={1}
      paddingY={1}
    >
      <Text>
        <Text color={theme.success}>Files changed</Text>
        <Text color={theme.muted}> / </Text>
        <Text color={theme.text}>{formatCounts(counts)}</Text>
      </Text>

      <Box flexDirection="column" marginTop={1}>
        {changeSet.files.map((file) => (
          <Box key={`${changeSet.id}:${file.path}`} flexDirection="column">
            <Text>
              <Text color={getStatusColor(file.status)}>{formatStatus(file.status)}</Text>
              <Text color={theme.muted}> </Text>
              <Text color={theme.text}>{file.path}</Text>
            </Text>
            <DiffPreview file={file} />
          </Box>
        ))}
      </Box>

      {debug && changeSet.checkpointPath ? (
        <Box marginTop={1}>
          <Text color={theme.faint}>checkpoint {changeSet.checkpointPath}</Text>
        </Box>
      ) : null}
    </Box>
  );
}

function summarizeFiles(files: readonly ChangedFileState[]): Record<string, number> {
  return files.reduce<Record<string, number>>((counts, file) => {
    counts[file.status] = (counts[file.status] ?? 0) + 1;
    return counts;
  }, {});
}

function formatCounts(counts: Record<string, number>): string {
  return [
    counts.created ? `${counts.created} created` : undefined,
    counts.modified ? `${counts.modified} modified` : undefined,
    counts.deleted ? `${counts.deleted} deleted` : undefined,
  ]
    .filter(Boolean)
    .join(", ");
}

function formatStatus(status: ChangedFileState["status"]): string {
  switch (status) {
    case "created":
      return "created";
    case "modified":
      return "modified";
    case "deleted":
      return "deleted";
  }
}

function getStatusColor(status: ChangedFileState["status"]): string {
  switch (status) {
    case "created":
      return theme.success;
    case "modified":
      return theme.accent;
    case "deleted":
      return theme.danger;
  }
}
