import {create} from "zustand";
import type {Workspace} from "@/entities/workspace/model/types";

interface WorkspaceState {
  activeWorkspaceId?: string;
  workspacesById: Record<string, Workspace>;
  setActiveWorkspace: (workspace: Workspace) => void;
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspacesById: {},
  setActiveWorkspace: (workspace) =>
    set((state) => ({
      activeWorkspaceId: workspace.id,
      workspacesById: {...state.workspacesById, [workspace.id]: workspace},
    })),
}));
