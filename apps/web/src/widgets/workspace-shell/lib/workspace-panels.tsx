import {FileExplorerPanel} from "@/features/file-explorer";
import {PreviewPanel} from "@/features/preview-runtime";
import {MainWorkspacePanel} from "@/widgets/workspace-shell/ui/MainWorkspacePanel";
import {createPanelRegistry} from "@/widgets/dock-layout";

export const workspacePanels = createPanelRegistry([
  {
    id: "project-explorer",
    title: "Project Explorer",
    region: "left",
    render: () => <FileExplorerPanel />,
  },
  {
    id: "agent-main",
    title: "Agent Workspace",
    region: "center",
    render: () => <MainWorkspacePanel />,
  },
  {
    id: "preview",
    title: "Live Preview",
    region: "right",
    render: () => <PreviewPanel />,
  },
]);
