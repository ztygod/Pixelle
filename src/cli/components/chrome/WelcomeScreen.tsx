import {Box, Text} from "ink";
import {WelcomeLogo} from "./WelcomeLogo.js";
import {theme} from "../../utils/theme.js";

type WelcomeScreenProps = {
  version: string;
  cwd: string;
  compact: boolean;
};

export function WelcomeScreen({version, cwd, compact}: WelcomeScreenProps) {
  if (compact) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <WelcomeLogo />
        <Text color={theme.muted}> v{version} / terminal design runtime · /help</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" marginBottom={1}>
      <WelcomeLogo />
      <Text color={theme.muted}>v{version} / terminal design runtime</Text>
      <Text color={theme.muted}>cwd {cwd}</Text>
      <Text color={theme.muted}>/help /clear /debug /exit</Text>
    </Box>
  );
}

