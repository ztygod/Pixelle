import {create} from "zustand";

type WorkspaceActivityState = "empty" | "active";

interface AgentRunState {
  activePrompt: string;
  workspaceState: WorkspaceActivityState;
  startExecution: (prompt: string) => void;
}

export const useAgentRunStore = create<AgentRunState>((set) => ({
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
