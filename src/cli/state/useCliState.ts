import {useEffect, useReducer} from "react";
import type {CliCommand, CliViewState} from "./cli-state.js";
import {
  initialCliState,
  parseCliCommand,
  reduceCliState,
} from "./cli-state.js";
import type {CliEvent, CliEventBus} from "../types.js";

export type UseCliStateResult = {
  state: CliViewState;
  runCommand(input: string): CliCommand | undefined;
};

export function useCliState(
  eventBus: CliEventBus,
  initialEvents: CliEvent[] = [],
): UseCliStateResult {
  const [state, dispatch] = useReducer(reduceCliState, initialCliState);

  useEffect(() => {
    for (const event of initialEvents) {
      dispatch({type: "event", event});
    }
  }, [initialEvents]);

  useEffect(
    () =>
      eventBus.subscribe((event) => {
        dispatch({type: "event", event});
      }),
    [eventBus],
  );

  return {
    state,
    runCommand(input) {
      const command = parseCliCommand(input);
      if (command) {
        dispatch({type: "command", command});
      }
      return command;
    },
  };
}

