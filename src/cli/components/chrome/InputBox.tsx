import {Box, Text, useInput} from "ink";
import {useState} from "react";
import type {UserInputBus} from "../../types.js";
import type {CliCommand} from "../../state/cli-state.js";
import {icons, theme} from "../../utils/theme.js";

type InputBoxProps = {
  userInputBus: UserInputBus;
  runCommand(input: string): CliCommand | undefined;
  width: number;
  onExit: () => void;
};

export function InputBox({userInputBus, runCommand, width, onExit}: InputBoxProps) {
  const [value, setValue] = useState("");
  const hasValue = value.length > 0;
  const borderColor = hasValue ? theme.brand : theme.border;
  const showSendHint = width >= 54;
  const isInteractive = Boolean(process.stdin.isTTY);
  const cursor = isInteractive ? `\u001B[5m${icons.cursor}\u001B[25m` : icons.cursor;

  useInput((input, key) => {
    if (key.return) {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        const command = runCommand(trimmed);
        if (command?.type === "exit") {
          onExit();
        } else if (!command) {
          userInputBus.emit({
            type: "submit",
            content: trimmed,
            createdAt: Date.now(),
          });
        }
      }
      setValue("");
      return;
    }

    if (key.backspace || key.delete) {
      setValue((current) => current.slice(0, -1));
      return;
    }

    if (key.ctrl || key.meta || input === "\u0003") {
      return;
    }

    if (input) {
      setValue((current) => current + input);
    }
  }, {isActive: isInteractive});

  return (
    <Box
      borderStyle="round"
      borderColor={borderColor}
      paddingX={1}
      marginTop={1}
      flexDirection="row"
      width="100%"
    >
      <Text color={hasValue ? theme.brand : theme.muted}>
        {hasValue ? icons.inputActive : icons.inputIdle}
      </Text>
      <Text color={theme.brand}> Pixelle</Text>
      <Text color={theme.muted}> {icons.user} </Text>
      <Box flexGrow={1}>
        {hasValue ? (
          <Text color={theme.text}>{value}</Text>
        ) : (
          <Text color={theme.muted}>Message Pixelle...</Text>
        )}
        <Text color={hasValue ? theme.brand : theme.muted}>
          {cursor}
        </Text>
      </Box>
      {showSendHint ? <Text color={theme.faint}> Enter to send</Text> : null}
    </Box>
  );
}
