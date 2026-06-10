import {Box, Text} from "ink";

import type {TraceState, VerificationState} from "../../types.js";
import {theme} from "../../utils/theme.js";

type RuntimeNoteProps =
  | {
      kind: "verification";
      verification: VerificationState;
      debug: boolean;
    }
  | {
      kind: "trace";
      trace: TraceState;
      debug: boolean;
    };

export function RuntimeNote(props: RuntimeNoteProps) {
  if (props.kind === "trace" && !props.debug) {
    return null;
  }

  if (props.kind === "trace") {
    return (
      <Box marginBottom={1}>
        <Text color={theme.faint}>trace {props.trace.path}</Text>
      </Box>
    );
  }

  return (
    <Box marginBottom={1}>
      <Text color={getVerificationColor(props.verification.status)}>
        {formatVerificationStatus(props.verification.status)}
      </Text>
      {props.debug ? (
        <Text color={theme.faint}> / {props.verification.commands.join(", ")}</Text>
      ) : null}
    </Box>
  );
}

function formatVerificationStatus(status: VerificationState["status"]): string {
  switch (status) {
    case "running":
      return "Verification running";
    case "passed":
      return "Verification passed";
    case "failed":
      return "Verification failed";
  }
}

function getVerificationColor(status: VerificationState["status"]): string {
  switch (status) {
    case "running":
      return theme.accent;
    case "passed":
      return theme.success;
    case "failed":
      return theme.danger;
  }
}
