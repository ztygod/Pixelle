import {Box, Text} from "ink";
import {theme} from "../../utils/theme.js";

type ErrorBlockProps = {
  message: string;
};

export function ErrorBlock({message}: ErrorBlockProps) {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Text>
        <Text color={theme.danger}>alert</Text>
        <Text color={theme.muted}> / </Text>
        <Text color={theme.danger}>{message}</Text>
      </Text>
    </Box>
  );
}

