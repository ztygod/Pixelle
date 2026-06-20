import type {AgentContextValue} from "../types.js";
import type {AgentRunState} from "./run-state.js";

/** Memory boundary used by ContextManager to load and persist contextual knowledge. */
export type AgentMemory = {
  /** Loads memory scoped to the current run or conversation. */
  loadRunMemory?(
    run: AgentRunState,
  ): Promise<readonly AgentContextValue[]> | readonly AgentContextValue[];
  /** Loads durable project-level memory and preferences. */
  loadProjectMemory?(
    run: AgentRunState,
  ): Promise<readonly AgentContextValue[]> | readonly AgentContextValue[];
  /** Persists any valuable information after the run has completed. */
  saveRunMemory?(run: AgentRunState): Promise<void> | void;
};

/** Creates a memory implementation that intentionally stores and returns nothing. */
export function createNoopMemory(): AgentMemory {
  return {
    loadRunMemory: () => [],
    loadProjectMemory: () => [],
    saveRunMemory: () => {},
  };
}
