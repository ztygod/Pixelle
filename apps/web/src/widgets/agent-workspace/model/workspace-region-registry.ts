import type {LucideIcon} from "lucide-react";
import type {ReactNode} from "react";

export type WorkspaceRegionPlacement =
  | "project-context"
  | "agent-interaction"
  | "app-preview"
  | "runtime-status";

export interface AgentWorkspaceRegionDefinition {
  id: string;
  title: string;
  placement: WorkspaceRegionPlacement;
  icon?: LucideIcon;
  minSize?: number;
  render: () => ReactNode;
}

export function createWorkspaceRegionRegistry(
  regions: AgentWorkspaceRegionDefinition[],
) {
  return regions;
}
