import {Box, Text, useInput} from "ink";
import {useState} from "react";
import type {UserInputBus} from "../adapters/event-bus.js";
import {submitUserInput} from "../hooks/useInputSubmit.js";

type InputBoxProps = {
  userInputBus: UserInputBus;
};

export function InputBox({userInputBus}: InputBoxProps) {
  const [value, setValue] = useState("");

  useInput((input, key) => {
    if (key.return) {
      submitUserInput(userInputBus, value);
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
  });

  return (
    <Box borderStyle="single" borderColor="blue" paddingX={1}>
      <Text color="blue">&gt; </Text>
      <Text>{value}</Text>
      <Text color="gray">_</Text>
    </Box>
  );
}
