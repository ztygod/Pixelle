import {Box, Text} from "ink";
import {theme} from "../../utils/theme.js";

export function CommandHelp() {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color={theme.primary} bold>
        Commands
      </Text>
      <Text color={theme.muted}>/help toggle help</Text>
      <Text color={theme.muted}>/clear clear timeline</Text>
      <Text color={theme.muted}>/debug toggle debug metadata</Text>
      <Text color={theme.muted}>/config reconfigure local provider and workspace</Text>
      <Text color={theme.muted}>/workspace [path] show or switch workspace</Text>
      <Text color={theme.muted}>
        /edit &lt;request&gt; allow file changes for one task
      </Text>
      <Text color={theme.muted}>/exit close terminal UI</Text>
    </Box>
  );
}
