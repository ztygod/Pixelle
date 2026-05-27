import {BottomStatusBar} from "./layout/BottomStatusBar";
import {NavigationRail} from "./layout/NavigationRail";
import {TopActionBar} from "./layout/TopActionBar";
import {ExplorerPanel} from "./panels/ExplorerPanel";
import {MainWorkspacePanel} from "./panels/MainWorkspacePanel";
import {PreviewPanel} from "./panels/PreviewPanel";

export function WorkspaceShell() {
  return (
    <main className="flex h-screen min-h-0 flex-col overflow-hidden p-3 text-[#f2f5ed] sm:p-4">
      <TopActionBar />
      <section className="grid min-h-0 flex-1 gap-3 overflow-y-auto py-3 xl:grid-cols-[56px_minmax(230px,280px)_minmax(420px,1fr)_minmax(330px,390px)] xl:overflow-hidden">
        <NavigationRail />
        <ExplorerPanel />
        <MainWorkspacePanel />
        <PreviewPanel />
      </section>
      <BottomStatusBar />
    </main>
  );
}
