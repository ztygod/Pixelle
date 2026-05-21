import { Box, Text } from "ink";
import { WelcomeLogo } from "./WelcomeLogo.js";
import { theme } from "../../utils/theme.js";

type GitStatus = "clean" | "modified" | "unknown";

type WelcomeScreenProps = {
  version: string;
  cwd: string;
  model?: string;
  gitBranch?: string;
  gitStatus?: GitStatus;
};

export function WelcomeScreen({
  version,
  cwd,
  model = "gpt-5.5",
  gitBranch = "main",
  gitStatus = "unknown",
}: WelcomeScreenProps) {
  const shortCwd = formatCwd(cwd);

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border}
      flexDirection="column"
      alignSelf="flex-start"
      marginBottom={1}
      paddingX={1}
      paddingY={1}
    >
      <Box>
        <WelcomeLogo />
      </Box>

      <Box marginTop={1} flexDirection="column">
        <InfoRow label="version" value={`v${version}`} />

        <InfoRow label="model" value={model} />

        <InfoRow
          label="git"
          value={`${gitBranch} ${formatGitStatus(gitStatus)}`}
        />

        <InfoRow label="directory" value={shortCwd} />
      </Box>
    </Box>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <Box>
      <Text color={theme.muted}> {label.padEnd(9)} </Text>

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
