import {Box, Text, useInput} from "ink";
import {useState} from "react";
import type {UserInputBus} from "../../types.js";
import type {CliCommand} from "../../state/cli-state.js";
import {icons, theme} from "../../utils/theme.js";

type InputBoxProps = {
  userInputBus: UserInputBus;
  runCommand(input: string): CliCommand | undefined;
  onExit: () => void;
};

export function InputBox({userInputBus, runCommand, onExit}: InputBoxProps) {
  const [value, setValue] = useState("");

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
  }, {isActive: Boolean(process.stdin.isTTY)});

  return (
    <Box paddingX={1}>
      <Text color={theme.brand}>Pixelle</Text>
      <Text color={theme.muted}> {icons.user} </Text>
      {value.length > 0 ? (
        <Text color={theme.text}>{value}</Text>
      ) : (
        <Text color={theme.muted}>Ask or type /help</Text>
      )}
      <Text color={theme.muted}>{icons.cursor}</Text>
    </Box>
  );
}
