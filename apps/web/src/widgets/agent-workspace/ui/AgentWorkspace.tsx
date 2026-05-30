import {AgentWorkspaceLayout} from "@/widgets/agent-workspace/ui/AgentWorkspaceLayout";
import {WorkspaceNavigationRail} from "@/widgets/workspace-navigation";
import {agentWorkspaceRegions} from "@/widgets/agent-workspace/config/agent-workspace-regions";
import {useWorkspaceAppearanceStore} from "@/widgets/agent-workspace/model/workspace-appearance-store";

export function AgentWorkspace() {
  const themeMode = useWorkspaceAppearanceStore((state) => state.themeMode);
  const toggleThemeMode = useWorkspaceAppearanceStore(
    (state) => state.toggleThemeMode,
  );

  const projectContextRegion = agentWorkspaceRegions.find(
    (region) => region.placement === "project-context",
  );
  const agentInteractionRegion = agentWorkspaceRegions.find(
    (region) => region.placement === "agent-interaction",
  );
  const appPreviewRegion = agentWorkspaceRegions.find(
    (region) => region.placement === "app-preview",
  );

  return (
    <main
      className={`workspace-theme ${themeMode} flex h-screen min-h-0 flex-col overflow-hidden p-3 text-[var(--color-text-primary)] sm:p-4`}
    >
      <AgentWorkspaceLayout
        agentInteraction={agentInteractionRegion?.render()}
        appPreview={appPreviewRegion?.render()}
        projectContext={projectContextRegion?.render()}
        workspaceNavigation={
          <WorkspaceNavigationRail
            onToggleTheme={toggleThemeMode}
            themeMode={themeMode}
          />
        }
      />
    </main>
  );
}
