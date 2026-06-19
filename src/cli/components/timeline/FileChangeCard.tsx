import {Box, Text} from "ink";

import type {ChangeSetState, ChangedFileState} from "../../types.js";
import {
  createFileChangeViewModel,
  type FileChangeKind,
  type FileChangeViewModel,
} from "../../utils/diff.js";
import {theme} from "../../utils/theme.js";
import {DiffPreview} from "./DiffPreview.js";

type FileChangeCardProps = {
  changeSet: ChangeSetState;
  debug: boolean;
};

export function FileChangeCard({changeSet, debug}: FileChangeCardProps) {
  const counts = summarizeFiles(changeSet.files);
  const changes = changeSet.files.map(createFileChangeViewModel);

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
        {changes.map((change) => (
          <Box key={`${changeSet.id}:${change.filePath}`} flexDirection="column">
            <FileChangeHeadline change={change} />
            {change.diff ? (
              <DiffPreview diff={change.diff} maxLines={120} showLineNumbers />
            ) : (
              <Box marginTop={1} paddingLeft={1}>
                <Text color={theme.faint}>no diff available</Text>
              </Box>
            )}
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

function FileChangeHeadline({change}: {change: FileChangeViewModel}) {
  return (
    <Text>
      <Text color={getKindColor(change.kind)}>{formatKind(change.kind)}</Text>
      <Text color={theme.muted}> </Text>
      {change.oldPath ? (
        <>
          <Text color={theme.muted}>{change.oldPath}</Text>
          <Text color={theme.muted}> → </Text>
        </>
      ) : null}
      <Text color={theme.text}>{change.filePath}</Text>
      <Text color={theme.muted}> (</Text>
      <Text color={theme.success}>+{change.addedLines ?? 0}</Text>
      <Text color={theme.muted}> </Text>
      <Text color={theme.danger}>-{change.removedLines ?? 0}</Text>
      <Text color={theme.muted}>)</Text>
    </Text>
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

function formatKind(kind: FileChangeKind): string {
  switch (kind) {
    case "created":
      return "Created";
    case "edited":
      return "Edited";
    case "deleted":
      return "Deleted";
    case "renamed":
      return "Renamed";
  }
}

function getKindColor(kind: FileChangeKind): string {
  switch (kind) {
    case "created":
      return theme.success;
    case "edited":
    case "renamed":
      return theme.accent;
    case "deleted":
      return theme.danger;
  }
}
