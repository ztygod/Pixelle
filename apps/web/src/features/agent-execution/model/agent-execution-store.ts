import {create} from "zustand";

type WorkspaceActivityState = "empty" | "active";

interface AgentExecutionState {
  activePrompt: string;
  workspaceState: WorkspaceActivityState;
  startExecution: (prompt: string) => void;
}

export const useAgentExecutionStore = create<AgentExecutionState>((set) => ({
  activePrompt: "",
  workspaceState: "empty",
  startExecution: (prompt) => {
    const nextPrompt = prompt.trim();

    if (!nextPrompt) {
      return;
    }

    set({
      activePrompt: nextPrompt,
      workspaceState: "active",
    });
  },
}));
