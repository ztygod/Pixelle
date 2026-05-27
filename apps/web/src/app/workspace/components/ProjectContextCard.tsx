import {projectSignals} from "../data/workspace-data";

export function ProjectContextCard() {
  return (
    <section>
      <div className="mb-3">
        <p className="mono-label text-[10px] uppercase text-[#7f8979]">Project Context</p>
        <h2 className="text-sm font-semibold text-[#f2f5ed]">Active signals</h2>
      </div>
      <div className="space-y-2">
        {projectSignals.map(({icon: Icon, label, value}) => (
          <div
            className="flex items-center gap-2 rounded-md border border-white/10 bg-white/[0.025] px-3 py-2"
            key={label}
          >
            <Icon className="text-[#b7ff55]" size={14} />
            <div className="min-w-0">
              <p className="mono-label text-[10px] uppercase text-[#6f796b]">{label}</p>
              <p className="truncate text-xs text-[#c8d2c0]">{value}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
