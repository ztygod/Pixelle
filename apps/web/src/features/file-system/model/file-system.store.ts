import {create} from "zustand";
import {
  pickWorkspaceDirectory,
  readTextFile,
  readWorkspaceTree,
  writeTextFile,
} from "@/features/file-system/services/browser-file-system.service";
import type {
  FileReadResult,
  FileSystemWorkspace,
} from "@/features/file-system/model/types";

interface FileSystemState {
  activeWorkspaceId: string | null;
  workspacesById: Record<string, FileSystemWorkspace>;
  isOpeningWorkspace: boolean;
  error: string | null;
}

interface FileSystemActions {
  openWorkspace: () => Promise<FileSystemWorkspace | null>;
  refreshWorkspace: (workspaceId: string) => Promise<FileSystemWorkspace | null>;
  readFile: (workspaceId: string, path: string) => Promise<FileReadResult>;
  writeFile: (
    workspaceId: string,
    path: string,
    content: string,
  ) => Promise<void>;
  clearError: () => void;
}

export const useFileSystemStore = create<FileSystemState & FileSystemActions>(
  (set, get) => ({
    activeWorkspaceId: null,
    workspacesById: {},
    isOpeningWorkspace: false,
    error: null,
    clearError: () => set({error: null}),
    openWorkspace: async () => {
      set({error: null, isOpeningWorkspace: true});

      try {
        const rootHandle = await pickWorkspaceDirectory();
        const {tree, fileHandlesByPath} = await readWorkspaceTree(rootHandle);
        const workspace: FileSystemWorkspace = {
          id: createWorkspaceId(rootHandle.name),
          rootName: rootHandle.name,
          rootHandle,
          tree,
          fileHandlesByPath,
          openedAt: Date.now(),
          refreshedAt: Date.now(),
        };

        set((state) => ({
          activeWorkspaceId: workspace.id,
          error: null,
          isOpeningWorkspace: false,
          workspacesById: {
            ...state.workspacesById,
            [workspace.id]: workspace,
          },
        }));

        return workspace;
      } catch (error) {
        set({
          error:
            error instanceof DOMException && error.name === "AbortError"
              ? null
              : getErrorMessage(error),
          isOpeningWorkspace: false,
        });
        return null;
      }
    },
    readFile: async (workspaceId, path) => {
      const workspace = getWorkspace(get(), workspaceId);
      // File contents are loaded lazily by the document layer, not during tree scan.
      const handle = workspace.fileHandlesByPath[path];

      if (!handle) {
        throw new Error(`${path} is not available in this workspace.`);
      }

      return readTextFile(path, handle);
    },
    refreshWorkspace: async (workspaceId) => {
      const workspace = getWorkspace(get(), workspaceId);
      const {tree, fileHandlesByPath} = await readWorkspaceTree(
        workspace.rootHandle,
      );
      const refreshedWorkspace = {
        ...workspace,
        tree,
        fileHandlesByPath,
        refreshedAt: Date.now(),
      };

      set((state) => ({
        workspacesById: {
          ...state.workspacesById,
          [workspaceId]: refreshedWorkspace,
        },
      }));

      return refreshedWorkspace;
    },
    writeFile: async (workspaceId, path, content) => {
      const workspace = getWorkspace(get(), workspaceId);
      const handle = workspace.fileHandlesByPath[path];

      if (!handle) {
        throw new Error(`${path} is not available in this workspace.`);
      }

      await writeTextFile(path, handle, content);
    },
  }),
);

function createWorkspaceId(rootName: string) {
  return `${rootName}:${Date.now()}`;
}

function getWorkspace(state: FileSystemState, workspaceId: string) {
  const workspace = state.workspacesById[workspaceId];

  if (!workspace) {
    throw new Error("Workspace is not open.");
  }

  return workspace;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while reading the folder.";
}
