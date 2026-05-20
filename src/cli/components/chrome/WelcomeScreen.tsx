import {Box, Text} from "ink";
import {WelcomeLogo} from "./WelcomeLogo.js";
import {theme} from "../../utils/theme.js";

type WelcomeScreenProps = {
  version: string;
  cwd: string;
  compact: boolean;
};

export function WelcomeScreen({version, cwd, compact}: WelcomeScreenProps) {
  const shortCwd = formatCwd(cwd);

  if (compact) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <WelcomeLogo />
        <Text color={theme.muted}>v{version} / {shortCwd} · /help</Text>
      </Box>
    );
  }

  return (
    <Box
      borderStyle="round"
      borderColor={theme.border}
      flexDirection="column"
      marginBottom={1}
      paddingX={2}
      paddingY={1}
      width="100%"
    >
      <Box flexDirection="row">
        <WelcomeLogo />
      </Box>
      <Box marginTop={1}>
        <Text color={theme.accent}>=^.^=</Text>
        <Text color={theme.muted}> ready in </Text>
        <Text color={theme.text}>{shortCwd}</Text>
      </Box>
      <Box>
        <Text color={theme.muted}>v{version} / local terminal session / ui only</Text>
      </Box>
      <Box marginTop={1}>
        <Text color={theme.faint}>/help  /clear  /debug  /exit</Text>
      </Box>
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

