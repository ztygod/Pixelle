import {Monitor, RefreshCw, Smartphone, Tablet} from "lucide-react";
import {Button} from "../../../components/ui/button";

export function PreviewPanel() {
  return (
    <aside className="workspace-panel flex min-h-[560px] min-w-0 flex-col overflow-hidden rounded-lg xl:h-full xl:min-h-0">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="min-w-0">
          <p className="mono-label text-[10px] uppercase text-[#7f8979]">Live Preview</p>
          <h2 className="truncate text-sm font-semibold text-[#f2f5ed]">Web App Preview</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1">
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
        <div className="flex min-h-full flex-col overflow-hidden rounded-lg border border-white/10 bg-[#080a08]">
          <div className="flex shrink-0 items-center gap-2 border-b border-white/10 bg-white/[0.03] px-3 py-2">
            <span className="size-2.5 rounded-full bg-[#ff6b6b]/80" />
            <span className="size-2.5 rounded-full bg-[#ffd166]/80" />
            <span className="size-2.5 rounded-full bg-[#b7ff55]/80" />
            <span className="mono-label ml-2 truncate text-[10px] text-[#7f8979]">
              localhost:5173
            </span>
          </div>
          <div className="grid min-h-56 flex-1 place-items-center p-4">
            <div className="w-full max-w-md rounded-lg border border-[#b7ff55]/16 bg-[#10140f] p-4 shadow-[0_0_44px_rgba(183,255,85,0.08)]">
              <p className="mono-label text-[10px] uppercase text-[#89a676]">Preview surface</p>
              <h3 className="mt-8 text-2xl font-semibold text-[#f2f5ed]">
                Build the workspace, then verify visually.
              </h3>
              <div className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(72px,1fr))] gap-2">
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
    </aside>
  );
}
