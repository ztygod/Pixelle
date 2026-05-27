import {TerminalSquare} from "lucide-react";
import {consoleLines} from "../data/workspace-data";

export function ConsolePanel() {
  return (
    <section className="workspace-panel flex min-h-0 flex-col overflow-hidden rounded-lg">
      <div className="flex shrink-0 items-center gap-2 border-b border-white/10 px-3 py-2">
        <TerminalSquare className="text-[#8d978a]" size={15} />
        <h2 className="text-sm font-semibold text-[#f2f5ed]">Console</h2>
      </div>
      <div className="mono-label min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3 text-[11px] leading-5 text-[#8b9585]">
        {consoleLines.map((line) => (
          <p className={line.includes("ready") ? "text-[#b7ff55]" : ""} key={line}>
            {line}
          </p>
        ))}
      </div>
    </section>
  );
}
