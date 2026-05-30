import {ProjectExplorerSidebar} from "@/features/project-explorer";
import {AppPreviewSidebar} from "@/features/app-preview";
import {AgentInteractionCenter} from "@/widgets/agent-workspace/ui/AgentInteractionCenter";
import {createWorkspaceRegionRegistry} from "@/widgets/agent-workspace/model/workspace-region-registry";

export const agentWorkspaceRegions = createWorkspaceRegionRegistry([
  {
    id: "project-explorer",
    title: "Project Explorer",
    placement: "project-context",
    render: () => <ProjectExplorerSidebar />,
  },
  {
    id: "agent-interaction",
    title: "Agent Interaction",
    placement: "agent-interaction",
    render: () => <AgentInteractionCenter />,
  },
  {
    id: "app-preview",
    title: "App Preview",
    placement: "app-preview",
    render: () => <AppPreviewSidebar />,
  },
]);
