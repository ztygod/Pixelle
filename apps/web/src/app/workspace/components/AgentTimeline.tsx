import {Check, Circle, Loader2} from "lucide-react";
import {cn} from "../../../lib/utils";
import {timelineItems} from "../data/workspace-data";
import type {TimelineState} from "../types";

interface AgentTimelineProps {
  visible: boolean;
}

export function AgentTimeline({visible}: AgentTimelineProps) {
  return (
    <section
      aria-hidden={!visible}
      className={cn(
        "shrink-0 overflow-hidden border-t border-white/10 bg-black/15 transition-all duration-300 ease-out",
        visible
          ? "max-h-[360px] translate-y-0 p-4 opacity-100 sm:p-5"
          : "max-h-0 translate-y-3 border-t-0 p-0 opacity-0",
      )}
    >
      <div
        className={cn(
          "mb-4 flex items-center justify-between transition duration-300 ease-out",
          visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
        )}
      >
        <div>
          <p className="mono-label text-[10px] uppercase text-[#7f8979]">Agent Timeline</p>
          <h2 className="text-sm font-semibold text-[#f2f5ed]">Current execution</h2>
        </div>
        <span className="mono-label rounded-full border border-[#b7ff55]/18 bg-[#b7ff55]/8 px-2.5 py-1 text-[11px] text-[#caff86]">
          running
        </span>
      </div>
      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 md:grid-cols-4 xl:max-h-48">
        {timelineItems.map((item) => (
          <article
            className="rounded-lg border border-white/10 bg-white/[0.03] p-3"
            key={item.label}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="mono-label text-[10px] uppercase text-[#8d978a]">{item.label}</span>
              <StateIcon state={item.state} />
            </div>
            <h3 className="text-sm font-medium text-[#eef4e8]">{item.title}</h3>
            <p className="mt-2 text-xs leading-5 text-[#8d978a]">{item.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function StateIcon({state}: {state: TimelineState}) {
  if (state === "done") {
    return (
      <span className="grid size-6 place-items-center rounded-full bg-[#b7ff55]/14 text-[#b7ff55]">
        <Check size={13} />
      </span>
    );
  }

  if (state === "running") {
    return (
      <span className="grid size-6 place-items-center rounded-full bg-[#b7ff55]/14 text-[#b7ff55]">
        <Loader2 className="animate-spin" size={13} />
      </span>
    );
  }

  return (
    <span className="grid size-6 place-items-center rounded-full bg-white/[0.04] text-[#687263]">
      <Circle size={10} />
    </span>
  );
}
