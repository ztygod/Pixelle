import type {
  CSSProperties,
  PointerEvent as ReactPointerEvent,
  ReactNode,
} from "react";
import {WorkspaceResizeHandle} from "@/widgets/agent-workspace/ui/WorkspaceResizeHandle";
import {useWorkspaceRegionSizeStore} from "@/widgets/agent-workspace/model/workspace-region-size-store";

const MIN_PROJECT_CONTEXT_WIDTH = 200;
const MAX_PROJECT_CONTEXT_WIDTH = 360;
const MIN_APP_PREVIEW_WIDTH = 280;
const MAX_APP_PREVIEW_WIDTH = 560;

interface AgentWorkspaceLayoutProps {
  agentInteraction: ReactNode;
  appPreview: ReactNode;
  projectContext: ReactNode;
  workspaceNavigation: ReactNode;
}

export function AgentWorkspaceLayout({
  agentInteraction,
  appPreview,
  projectContext,
  workspaceNavigation,
}: AgentWorkspaceLayoutProps) {
  const regionWidths = useWorkspaceRegionSizeStore((state) => state.regionWidths);
  const setRegionWidth = useWorkspaceRegionSizeStore(
    (state) => state.setRegionWidth,
  );

  function startResize(
    region: keyof typeof regionWidths,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidths = {...regionWidths};

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;

      if (region === "projectContext") {
        setRegionWidth(
          "projectContext",
          clamp(
            startWidths.projectContext + deltaX,
            MIN_PROJECT_CONTEXT_WIDTH,
            MAX_PROJECT_CONTEXT_WIDTH,
          ),
        );
      }

      if (region === "appPreview") {
        setRegionWidth(
          "appPreview",
          clamp(
            startWidths.appPreview - deltaX,
            MIN_APP_PREVIEW_WIDTH,
            MAX_APP_PREVIEW_WIDTH,
          ),
        );
      }
    }

    function stopResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  }

  return (
    <section
      className="grid min-h-0 flex-1 gap-3 overflow-y-auto pb-3 xl:grid-cols-[56px_var(--project-context-width)_minmax(360px,1fr)_var(--app-preview-width)] xl:overflow-hidden"
      style={
        {
          "--project-context-width": `${regionWidths.projectContext}px`,
          "--app-preview-width": `${regionWidths.appPreview}px`,
        } as CSSProperties
      }
    >
      {workspaceNavigation}
      <div className="relative flex min-h-0 min-w-0">
        {projectContext}
        <WorkspaceResizeHandle
          label="Resize project context"
          onPointerDown={(event) => startResize("projectContext", event)}
        />
      </div>
      <div className="relative flex min-h-0 min-w-0">
        {agentInteraction}
        <WorkspaceResizeHandle
          label="Resize app preview"
          onPointerDown={(event) => startResize("appPreview", event)}
        />
      </div>
      {appPreview}
    </section>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
