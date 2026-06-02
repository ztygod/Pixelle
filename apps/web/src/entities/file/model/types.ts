import type {WorkspaceFile} from "@/shared/types/agent-types";

export interface FileTreeNode {
  name: string;
  type: "folder" | "file";
  active?: boolean;
  modified?: boolean;
  children?: FileTreeNode[];
}

export type ProjectFile = WorkspaceFile;
