import {Box, Text} from "ink";
import {theme} from "../../utils/theme.js";

type GitStatus = "clean" | "modified" | "unknown";

type WelcomeScreenProps = {
  version: string;
  cwd: string;
  model?: string;
  provider?: string;
  gitBranch?: string;
  gitStatus?: GitStatus;
};

export function WelcomeScreen({
  version,
  cwd,
  model = "not configured",
  provider = "provider",
  gitBranch = "unknown",
  gitStatus = "unknown",
}: WelcomeScreenProps) {
  const shortCwd = formatCwd(cwd);

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      paddingX={2}
      paddingY={1}
      borderStyle="single"
      borderColor={theme.faint}
      alignSelf="flex-start"
    >
      <Box flexDirection="row">
        <Text color={theme.brand} bold>
          Pixelle
        </Text>
        <Text color={theme.muted}> Agent </Text>
        <Text color={theme.faint}>v{version}</Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        <InfoRow label="workspace" value={shortCwd} />
        <InfoRow label="model" value={model} />
        <InfoRow label="provider" value={provider} />
        <InfoRow label="git" value={`${gitBranch} ${formatGitStatus(gitStatus)}`} />
      </Box>
    </Box>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({label, value}: InfoRowProps) {
  return (
    <Box flexDirection="row">
      <Box width={12}>
        <Text color={theme.muted}>{label}</Text>
      </Box>

      <Text color={theme.faint}>│ </Text>

      <Text color={theme.text}>{value}</Text>
    </Box>
  );
}

function formatCwd(cwd: string): string {
  const normalized = cwd.replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);

  if (parts.length <= 3) {
    return cwd;
  }

  return `.../${parts.slice(-3).join("/")}`;
}

function formatGitStatus(status: GitStatus): string {
  switch (status) {
    case "clean":
      return "✓ clean";

    case "modified":
      return "● modified";

    case "unknown":
      return "? unknown";

    default:
      return status;
  }
}
