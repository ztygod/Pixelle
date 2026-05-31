import {FileExplorerPanel} from "@/features/file-explorer";
import {AppPreviewSidebar} from "@/features/app-preview";
import {AgentInteractionCenter} from "@/widgets/agent-workspace/ui/AgentInteractionCenter";
import {useAgentInteractionViewStore} from "@/widgets/agent-workspace/model/agent-interaction-view-store";
import {createWorkspaceRegionRegistry} from "@/widgets/agent-workspace/model/workspace-region-registry";

export const agentWorkspaceRegions = createWorkspaceRegionRegistry([
  {
    id: "file-explorer",
    title: "File Explorer",
    placement: "project-context",
    render: () => (
      <FileExplorerPanel
        onFileOpen={() =>
          useAgentInteractionViewStore.getState().setActiveView("code")
        }
      />
    ),
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
