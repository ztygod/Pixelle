import {create} from "zustand";
import {openDirectoryTree, readOpenedFile} from "@/features/file-explorer/services/browser-file-system.service";
import type {
  FileExplorerState,
  FileNode,
  OpenedFile,
} from "@/features/file-explorer/model/types";

interface FileExplorerActions {
  openFolder: () => Promise<void>;
  openFile: (node: FileNode) => Promise<OpenedFile | null>;
  toggleFolder: (path: string) => void;
  clearError: () => void;
}

const initialState: FileExplorerState = {
  rootName: null,
  tree: [],
  selectedFilePath: null,
  openedFiles: [],
  activeFilePath: null,
  expandedFolderPaths: new Set(),
  isLoading: false,
  error: null,
};

export const useFileExplorerStore = create<
  FileExplorerState & FileExplorerActions
>((set) => ({
  ...initialState,
  clearError: () => set({error: null}),
  openFile: async (node) => {
    if (node.type !== "file") {
      return null;
    }

    set({error: null, selectedFilePath: node.path});

    try {
      const openedFile = await readOpenedFile(node);

      set((state) => ({
        activeFilePath: openedFile.path,
        openedFiles: upsertOpenedFile(state.openedFiles, openedFile),
        selectedFilePath: openedFile.path,
      }));

      return openedFile;
    } catch (error) {
      set({error: getErrorMessage(error)});
      return null;
    }
  },
  openFolder: async () => {
    set({error: null, isLoading: true});

    try {
      const {rootName, tree} = await openDirectoryTree();

      set({
        activeFilePath: null,
        error: null,
        expandedFolderPaths: new Set(),
        isLoading: false,
        openedFiles: [],
        rootName,
        selectedFilePath: null,
        tree,
      });
    } catch (error) {
      set({
        error:
          error instanceof DOMException && error.name === "AbortError"
            ? null
            : getErrorMessage(error),
        isLoading: false,
      });
    }
  },
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

function upsertOpenedFile(openedFiles: OpenedFile[], openedFile: OpenedFile) {
  const existingIndex = openedFiles.findIndex(
    (file) => file.path === openedFile.path,
  );

  if (existingIndex === -1) {
    return [...openedFiles, openedFile];
  }

  return openedFiles.map((file, index) =>
    index === existingIndex ? openedFile : file,
  );
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while reading the folder.";
}
