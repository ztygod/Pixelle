import {create} from "zustand";

interface FileSelectionState {
  selectedPath?: string;
  selectPath: (path: string) => void;
}

export const useFileSelectionStore = create<FileSelectionState>((set) => ({
  selectPath: (path) => set({selectedPath: path}),
}));
