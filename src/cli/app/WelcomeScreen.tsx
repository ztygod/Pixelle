import {Box, Text} from "ink";
import {WelcomeLogo} from "../components/WelcomeLogo.js";
import {theme} from "../utils/theme.js";

type WelcomeScreenProps = {
  version: string;
  cwd: string;
  compact: boolean;
};

export function WelcomeScreen({version, cwd, compact}: WelcomeScreenProps) {
  if (compact) {
    return (
      <Box marginBottom={1}>
        <Text color={theme.primary} bold>
          Pixelle
        </Text>
        <Text color={theme.muted}> v{version} · UI only · /help</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <WelcomeLogo />
      <Text color={theme.muted}>v{version} · mode: UI only</Text>
      <Text color={theme.muted}>cwd: {cwd}</Text>
      <Text color={theme.muted}>shortcuts: /help /clear /debug /exit</Text>
    </Box>
  );
}

