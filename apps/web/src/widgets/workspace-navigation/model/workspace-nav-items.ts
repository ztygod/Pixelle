import {
  Box,
  Files,
  GitBranch,
  MessageSquare,
  Puzzle,
  Settings,
} from "lucide-react";
import type {LucideIcon} from "lucide-react";

export interface WorkspaceNavItem {
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

export const workspaceNavItems: WorkspaceNavItem[] = [
  {label: "Chat", icon: MessageSquare, active: true},
  {label: "Files", icon: Files},
  {label: "Git", icon: GitBranch},
  {label: "Sandbox", icon: Box},
  {label: "Plugins", icon: Puzzle},
  {label: "Settings", icon: Settings},
];
