import {useEffect, useReducer} from "react";
import type {CliViewState} from "./cli-state.js";
import {initialCliState, reduceCliState} from "./cli-state.js";
import type {CliEvent, CliEventBus} from "../types.js";

export type UseCliStateResult = {
  state: CliViewState;
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

  return {state};
}

