import {Monitor, RefreshCw, Smartphone, Tablet} from "lucide-react";
import {Button} from "../../../components/ui/button";
import {ConsolePanel} from "../components/ConsolePanel";
import {RuntimeStatusGrid} from "../components/RuntimeStatusGrid";

export function PreviewPanel() {
  return (
    <aside className="grid min-h-[560px] min-w-0 gap-3 overflow-hidden xl:min-h-0 xl:grid-rows-[1.1fr_0.75fr_0.8fr]">
      <section className="workspace-panel flex min-h-0 flex-col overflow-hidden rounded-lg">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
          <div>
            <p className="mono-label text-[10px] uppercase text-[#7f8979]">Live Preview</p>
            <h2 className="text-sm font-semibold text-[#f2f5ed]">Web App Preview</h2>
          </div>
          <div className="flex items-center gap-1">
            <Button aria-label="Desktop preview" size="icon-sm" variant="ghost">
              <Monitor size={15} />
            </Button>
            <Button aria-label="Tablet preview" size="icon-sm" variant="ghost">
              <Tablet size={15} />
            </Button>
            <Button aria-label="Mobile preview" size="icon-sm" variant="ghost">
              <Smartphone size={15} />
            </Button>
            <Button aria-label="Refresh preview" size="icon-sm" variant="outline">
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <div className="min-h-full overflow-hidden rounded-lg border border-white/10 bg-[#080a08]">
            <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2">
              <span className="size-2.5 rounded-full bg-[#ff6b6b]/80" />
              <span className="size-2.5 rounded-full bg-[#ffd166]/80" />
              <span className="size-2.5 rounded-full bg-[#b7ff55]/80" />
              <span className="mono-label ml-2 truncate text-[10px] text-[#7f8979]">
                localhost:5173
              </span>
            </div>
            <div className="min-h-56 p-4">
              <div className="rounded-lg border border-[#b7ff55]/16 bg-[#10140f] p-4 shadow-[0_0_44px_rgba(183,255,85,0.08)]">
                <p className="mono-label text-[10px] uppercase text-[#89a676]">Preview surface</p>
                <h3 className="mt-8 text-2xl font-semibold text-[#f2f5ed]">
                  Build the workspace, then verify visually.
                </h3>
                <div className="mt-8 grid grid-cols-3 gap-2">
                  {["Plan", "Patch", "Run"].map((label) => (
                    <div
                      className="rounded-md border border-white/10 bg-white/[0.04] p-3"
                      key={label}
                    >
                      <span className="mono-label text-[10px] text-[#b7ff55]">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <ConsolePanel />
      <RuntimeStatusGrid />
    </aside>
  );
}
