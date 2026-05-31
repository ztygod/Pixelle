import {create} from "zustand";

export type AgentInteractionView = "chat" | "code";

interface AgentInteractionViewState {
  activeView: AgentInteractionView;
  setActiveView: (view: AgentInteractionView) => void;
}

export const useAgentInteractionViewStore =
  create<AgentInteractionViewState>((set) => ({
    activeView: "chat",
    setActiveView: (activeView) => set({activeView}),
  }));
