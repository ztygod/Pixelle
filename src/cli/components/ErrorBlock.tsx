import {Box, Text} from "ink";
import {theme} from "../utils/theme.js";

type ErrorBlockProps = {
  message: string;
};

export function ErrorBlock({message}: ErrorBlockProps) {
  return (
    <Box
      borderStyle="single"
      borderColor={theme.danger}
      flexDirection="column"
      marginBottom={1}
      paddingX={1}
    >
      <Text color={theme.danger}>! {message}</Text>
    </Box>
  );
}

