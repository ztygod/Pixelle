import {Box, Text} from "ink";
import {theme} from "../utils/theme.js";

export function CommandHelp() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.primary} bold>
        Commands
      </Text>
      <Text color={theme.muted}>/help   Toggle this help</Text>
      <Text color={theme.muted}>/clear  Clear UI messages and local status</Text>
      <Text color={theme.muted}>/debug  Toggle event/debug metadata</Text>
      <Text color={theme.muted}>/exit   Close the terminal UI</Text>
    </Box>
  );
}

