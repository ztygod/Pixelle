import {create} from "zustand";

interface ProjectFileSelectionState {
  selectedPath?: string;
  selectPath: (path: string) => void;
}

export const useProjectFileSelectionStore = create<ProjectFileSelectionState>(
  (set) => ({
    selectPath: (path) => set({selectedPath: path}),
  }),
);
