import {Activity, ChevronDown, Cpu, RadioTower} from "lucide-react";
import {Badge} from "../../../components/ui/badge";
import {Button} from "../../../components/ui/button";
import {workspaceModes} from "../data/workspace-data";

export function TopActionBar() {
  return (
    <header className="workspace-panel flex min-h-14 shrink-0 flex-wrap items-center justify-between gap-3 rounded-lg px-3 py-2">
      <div className="flex min-w-0 items-center gap-3">
        <div className="grid size-8 place-items-center rounded-md border border-[#b7ff55]/20 bg-[#b7ff55]/10 text-[#b7ff55] shadow-[0_0_28px_rgba(183,255,85,0.12)]">
          <span className="text-sm font-semibold">P</span>
        </div>
        <div className="min-w-0">
          <p className="mono-label text-[10px] uppercase text-[#87917f]">Pixelle</p>
          <h1 className="truncate text-sm font-semibold text-[#f2f5ed] sm:text-base">
            AI Coding Workspace
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-full border border-white/10 bg-black/20 p-1">
          {workspaceModes.map((mode) => (
            <button
              className={
                mode === "BUILD"
                  ? "mono-label rounded-full bg-[#b7ff55] px-3 py-1.5 text-[11px] font-semibold text-[#071006]"
                  : "mono-label rounded-full px-3 py-1.5 text-[11px] text-[#8d978a] transition hover:text-[#f2f5ed]"
              }
              key={mode}
              type="button"
            >
              {mode}
            </button>
          ))}
        </div>

        <Button className="hidden sm:inline-flex" size="sm" variant="outline">
          <Cpu size={14} />
          Pixelle Agent
          <ChevronDown size={14} />
        </Button>
        <Button className="hidden md:inline-flex" size="sm" variant="outline">
          <RadioTower size={14} />
          Web Runtime
          <ChevronDown size={14} />
        </Button>
        <Badge className="border-[#b7ff55]/20 bg-[#b7ff55]/10 text-[#cbff89]">
          <Activity className="size-3 animate-pulse" />
          Runtime Active
        </Badge>
      </div>
    </header>
  );
}
