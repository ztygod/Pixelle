import { DockLayout } from "@/widgets/dock-layout";
import { NavigationRail } from "@/widgets/navigation";
import { workspacePanels } from "@/widgets/workspace-shell/lib/workspace-panels";
import { useWorkspaceLayoutStore } from "@/widgets/workspace-shell/model/workspace-layout-store";

export function WorkspaceShell() {
  const themeMode = useWorkspaceLayoutStore((state) => state.themeMode);
  const toggleThemeMode = useWorkspaceLayoutStore(
    (state) => state.toggleThemeMode,
  );

  const leftPanel = workspacePanels.find((panel) => panel.region === "left");
  const centerPanel = workspacePanels.find(
    (panel) => panel.region === "center",
  );
  const rightPanel = workspacePanels.find((panel) => panel.region === "right");

  return (
    <main
      className={`workspace-theme ${themeMode} flex h-screen min-h-0 flex-col overflow-hidden p-3 text-[#f2f5ed] sm:p-4`}
    >
      <DockLayout
        center={centerPanel?.render()}
        left={leftPanel?.render()}
        navigation={
          <NavigationRail
            onToggleTheme={toggleThemeMode}
            themeMode={themeMode}
          />
        }
        right={rightPanel?.render()}
      />
      {/* <WorkspaceStatusBar /> */}
    </main>
  );
}
