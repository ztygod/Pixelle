import {create} from "zustand";
import {useFileSystemStore} from "@/features/file-system";
import type {FileNode} from "@/features/file-system";

export type FileExplorerState = {
  selectedFilePath: string | null;
  expandedFolderPaths: Set<string>;
};

interface FileExplorerActions {
  openFolder: () => Promise<void>;
  selectFile: (path: string) => void;
  toggleFolder: (path: string) => void;
}

export const useFileExplorerStore = create<
  FileExplorerState & FileExplorerActions
>((set) => ({
  selectedFilePath: null,
  expandedFolderPaths: new Set(),
  openFolder: async () => {
    const workspace = await useFileSystemStore.getState().openWorkspace();

    if (!workspace) {
      return;
    }

    set({
      expandedFolderPaths: new Set(),
      selectedFilePath: null,
    });
  },
  selectFile: (path) => set({selectedFilePath: path}),
  toggleFolder: (path) =>
    set((state) => {
      const expandedFolderPaths = new Set(state.expandedFolderPaths);

      if (expandedFolderPaths.has(path)) {
        expandedFolderPaths.delete(path);
      } else {
        expandedFolderPaths.add(path);
      }

      return {expandedFolderPaths};
    }),
}));

export type {FileNode};
