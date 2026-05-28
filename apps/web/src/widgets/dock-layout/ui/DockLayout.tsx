import type {CSSProperties, PointerEvent as ReactPointerEvent, ReactNode} from "react";
import {ResizeHandle} from "@/widgets/dock-layout/ui/ResizeHandle";
import {useDockLayoutStore} from "@/widgets/dock-layout/model/dock-layout-store";

const MIN_EXPLORER_WIDTH = 200;
const MAX_EXPLORER_WIDTH = 360;
const MIN_PREVIEW_WIDTH = 280;
const MAX_PREVIEW_WIDTH = 560;

interface DockLayoutProps {
  center: ReactNode;
  left: ReactNode;
  navigation: ReactNode;
  right: ReactNode;
}

export function DockLayout({center, left, navigation, right}: DockLayoutProps) {
  const panelWidths = useDockLayoutStore((state) => state.panelWidths);
  const setPanelWidth = useDockLayoutStore((state) => state.setPanelWidth);

  function startResize(
    edge: keyof typeof panelWidths,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidths = {...panelWidths};

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;

      if (edge === "explorer") {
        setPanelWidth(
          "explorer",
          clamp(startWidths.explorer + deltaX, MIN_EXPLORER_WIDTH, MAX_EXPLORER_WIDTH),
        );
      }

      if (edge === "preview") {
        setPanelWidth(
          "preview",
          clamp(startWidths.preview - deltaX, MIN_PREVIEW_WIDTH, MAX_PREVIEW_WIDTH),
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
      className="grid min-h-0 flex-1 gap-3 overflow-y-auto pb-3 xl:grid-cols-[56px_var(--explorer-width)_minmax(360px,1fr)_var(--preview-width)] xl:overflow-hidden"
      style={
        {
          "--explorer-width": `${panelWidths.explorer}px`,
          "--preview-width": `${panelWidths.preview}px`,
        } as CSSProperties
      }
    >
      {navigation}
      <div className="relative flex min-h-0 min-w-0">
        {left}
        <ResizeHandle
          label="Resize file explorer"
          onPointerDown={(event) => startResize("explorer", event)}
        />
      </div>
      <div className="relative flex min-h-0 min-w-0">
        {center}
        <ResizeHandle
          label="Resize preview panel"
          onPointerDown={(event) => startResize("preview", event)}
        />
      </div>
      {right}
    </section>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
