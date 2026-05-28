import {useEffect, useState} from "react";
import type {CSSProperties, PointerEvent as ReactPointerEvent} from "react";
import {BottomStatusBar} from "./layout/BottomStatusBar";
import {NavigationRail} from "./layout/NavigationRail";
import {ExplorerPanel} from "./panels/ExplorerPanel";
import {MainWorkspacePanel} from "./panels/MainWorkspacePanel";
import {PreviewPanel} from "./panels/PreviewPanel";

const MIN_EXPLORER_WIDTH = 200;
const MAX_EXPLORER_WIDTH = 360;
const MIN_PREVIEW_WIDTH = 280;
const MAX_PREVIEW_WIDTH = 560;

interface PanelWidths {
  explorer: number;
  preview: number;
}

type ThemeMode = "dark" | "light";

export function WorkspaceShell() {
  const [panelWidths, setPanelWidths] = useState<PanelWidths>({
    explorer: 260,
    preview: 360,
  });
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const savedTheme = window.localStorage.getItem("pixelle-theme");

    return savedTheme === "light" ? "light" : "dark";
  });

  useEffect(() => {
    window.localStorage.setItem("pixelle-theme", themeMode);
  }, [themeMode]);

  function startResize(
    edge: keyof PanelWidths,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.preventDefault();

    const startX = event.clientX;
    const startWidths = {...panelWidths};

    function handlePointerMove(moveEvent: PointerEvent) {
      const deltaX = moveEvent.clientX - startX;

      setPanelWidths({
        explorer:
          edge === "explorer"
            ? clamp(startWidths.explorer + deltaX, MIN_EXPLORER_WIDTH, MAX_EXPLORER_WIDTH)
            : startWidths.explorer,
        preview:
          edge === "preview"
            ? clamp(startWidths.preview - deltaX, MIN_PREVIEW_WIDTH, MAX_PREVIEW_WIDTH)
            : startWidths.preview,
      });
    }

    function stopResize() {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", stopResize);
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", stopResize);
  }

  function toggleThemeMode() {
    setThemeMode((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  return (
    <main
      className={`workspace-theme ${themeMode} flex h-screen min-h-0 flex-col overflow-hidden p-3 text-[#f2f5ed] sm:p-4`}
    >
      <section
        className="grid min-h-0 flex-1 gap-3 overflow-y-auto pb-3 xl:grid-cols-[56px_var(--explorer-width)_minmax(360px,1fr)_var(--preview-width)] xl:overflow-hidden"
        style={
          {
            "--explorer-width": `${panelWidths.explorer}px`,
            "--preview-width": `${panelWidths.preview}px`,
          } as CSSProperties
        }
      >
        <NavigationRail onToggleTheme={toggleThemeMode} themeMode={themeMode} />
        <div className="relative flex min-h-0 min-w-0">
          <ExplorerPanel />
          <ResizeHandle
            label="Resize file explorer"
            onPointerDown={(event) => {
              startResize("explorer", event);
            }}
          />
        </div>
        <div className="relative flex min-h-0 min-w-0">
          <MainWorkspacePanel />
          <ResizeHandle
            label="Resize preview panel"
            onPointerDown={(event) => {
              startResize("preview", event);
            }}
          />
        </div>
        <PreviewPanel />
      </section>
      <BottomStatusBar />
    </main>
  );
}

function ResizeHandle({
  label,
  onPointerDown,
}: {
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      aria-label={label}
      className="group absolute -right-3 top-2 z-10 hidden h-[calc(100%-1rem)] w-3 cursor-col-resize touch-none items-center justify-center xl:flex"
      onPointerDown={onPointerDown}
      role="separator"
      title={label}
    >
      <span className="h-12 w-px rounded-full bg-white/10 transition group-hover:bg-[#b7ff55]/70" />
    </div>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
