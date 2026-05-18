import {Box, Text, useInput} from "ink";
import {useState} from "react";
import type {UserInputBus} from "../events/event-bus.js";
import type {CliCommand} from "../state/cli-state.js";
import {theme} from "../utils/theme.js";

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
    <Box borderStyle="single" borderColor={theme.border} paddingX={1}>
      <Text color={theme.primary}>&gt; </Text>
      {value.length > 0 ? (
        <Text>{value}</Text>
      ) : (
        <Text color={theme.muted}>Ask Pixelle or type /help</Text>
      )}
      <Text color={theme.muted}>_</Text>
    </Box>
  );
}
