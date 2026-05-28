import type {LucideIcon} from "lucide-react";
import type {ReactNode} from "react";

export type DockRegion = "left" | "center" | "right" | "bottom";

export interface WorkspacePanelDefinition {
  id: string;
  title: string;
  region: DockRegion;
  icon?: LucideIcon;
  minSize?: number;
  render: () => ReactNode;
}

export function createPanelRegistry(panels: WorkspacePanelDefinition[]) {
  return panels;
}
