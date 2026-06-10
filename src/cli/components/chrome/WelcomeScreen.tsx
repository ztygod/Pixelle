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
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row">
        <Text color={theme.brand} bold>
          Pixelle
        </Text>
        <Text color={theme.muted}> Agent </Text>
        <Text color={theme.faint}>v{version}</Text>
      </Box>

      <Box marginTop={1} flexDirection="row" flexWrap="wrap">
        <InfoPill label="workspace" value={shortCwd} />
        <InfoPill label="model" value={model} />
        <InfoPill label="provider" value={provider} />
        <InfoPill label="git" value={`${gitBranch} ${formatGitStatus(gitStatus)}`} />
      </Box>
    </Box>
  );
}

type InfoPillProps = {
  label: string;
  value: string;
};

function InfoPill({label, value}: InfoPillProps) {
  return (
    <Box marginRight={2}>
      <Text color={theme.muted}>{label} </Text>

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
