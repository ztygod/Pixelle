import {Box, Text, useInput} from "ink";
import {useEffect, useState} from "react";
import {icons, theme} from "../../utils/theme.js";

type InputBoxProps = {
  onSubmit(input: string): void;
  width: number;
};

export function InputBox({onSubmit, width}: InputBoxProps) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const hasValue = value.length > 0;
  const borderColor = submitted ? theme.success : hasValue ? theme.brand : theme.border;
  const showSendHint = width >= 54;
  const isInteractive = Boolean(process.stdin.isTTY);
  const cursor = isInteractive ? `\u001B[5m${icons.cursor}\u001B[25m` : icons.cursor;
  const modeLabel = submitted ? "submitted" : hasValue ? "compose" : "console";

  useEffect(() => {
    if (!submitted) {
      return undefined;
    }

    const timer = setTimeout(() => {
      setSubmitted(false);
    }, 450);

    return () => {
      clearTimeout(timer);
    };
  }, [submitted]);

  useInput(
    (input, key) => {
      if (key.return) {
        const trimmed = value.trim();
        if (trimmed.length > 0) {
          onSubmit(trimmed);
          setSubmitted(true);
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
    },
    {isActive: isInteractive},
  );

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
        {submitted ? icons.done : hasValue ? icons.inputActive : icons.inputIdle}
      </Text>
      <Text color={theme.brand}> Pixelle</Text>
      <Text color={theme.muted}>
        {" "}
        {modeLabel} {icons.user}{" "}
      </Text>
      <Box flexGrow={1}>
        {hasValue ? (
          <Text color={theme.text}>{value}</Text>
        ) : (
          <Text color={theme.muted}>Ask Pixelle or type /help</Text>
        )}
        <Text color={hasValue ? theme.brand : theme.muted}>{cursor}</Text>
      </Box>
      {showSendHint ? <Text color={theme.faint}> Enter to send</Text> : null}
    </Box>
  );
}
