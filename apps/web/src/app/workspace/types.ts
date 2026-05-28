import type {LucideIcon} from "lucide-react";

export interface NavItem {
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

export interface FileTreeNode {
  name: string;
  type: "folder" | "file";
  active?: boolean;
  modified?: boolean;
  children?: FileTreeNode[];
}

export interface QuickAction {
  title: string;
  description: string;
  icon: LucideIcon;
}

export type TimelineState = "done" | "running" | "queued";

export interface TimelineItem {
  label: string;
  title: string;
  description: string;
  state: TimelineState;
}
