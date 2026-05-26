import type {PatchSummary, WorkspaceFile} from "@pixelle/types";

export type FileSystemAdapter = {
  readFile(path: string): Promise<WorkspaceFile>;
  writeFile(file: WorkspaceFile): Promise<void>;
  listFiles(patterns?: readonly string[]): Promise<readonly string[]>;
};

export type ShellAdapter = {
  run(command: string, args?: readonly string[]): Promise<{
    exitCode: number;
    stdout: string;
    stderr: string;
  }>;
};

export type GitAdapter = {
  diff(): Promise<string>;
  currentBranch(): Promise<string | undefined>;
  commit(message: string): Promise<void>;
};

export type PatchAdapter = {
  createPatch(files: readonly WorkspaceFile[]): Promise<PatchSummary>;
  applyPatch(patch: string): Promise<PatchSummary>;
};
