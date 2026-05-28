import type {WorkspaceFile} from "@pixelle/types";

export interface FileTreeNode {
  name: string;
  type: "folder" | "file";
  active?: boolean;
  modified?: boolean;
  children?: FileTreeNode[];
}

export type ProjectFile = WorkspaceFile;
