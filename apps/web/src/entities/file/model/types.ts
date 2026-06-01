import type {WorkspaceFile} from "@pixelle/agent";

export interface FileTreeNode {
  name: string;
  type: "folder" | "file";
  active?: boolean;
  modified?: boolean;
  children?: FileTreeNode[];
}

export type ProjectFile = WorkspaceFile;
