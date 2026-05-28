import {create} from "zustand";
import type {ProjectFile} from "@/entities/file/model/types";

interface FileState {
  activePath?: string;
  filesByPath: Record<string, ProjectFile>;
  setActivePath: (path: string) => void;
  upsertFile: (file: ProjectFile) => void;
}

export const useFileStore = create<FileState>((set) => ({
  filesByPath: {},
  setActivePath: (path) => set({activePath: path}),
  upsertFile: (file) =>
    set((state) => ({
      filesByPath: {...state.filesByPath, [file.path]: file},
    })),
}));
