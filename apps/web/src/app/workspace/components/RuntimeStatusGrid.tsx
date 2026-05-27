import {runtimeMetrics} from "../data/workspace-data";

export function RuntimeStatusGrid() {
  return (
    <section className="workspace-panel flex min-h-0 flex-col overflow-hidden rounded-lg p-3">
      <div className="mb-3 shrink-0">
        <p className="mono-label text-[10px] uppercase text-[#7f8979]">Runtime Status</p>
        <h2 className="text-sm font-semibold text-[#f2f5ed]">Session telemetry</h2>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1">
        {runtimeMetrics.map((metric) => (
          <article
            className="rounded-md border border-white/10 bg-white/[0.03] p-3"
            key={metric.label}
          >
            <p className="mono-label text-[10px] uppercase text-[#7f8979]">{metric.label}</p>
            <strong className="mt-1 block text-sm font-semibold text-[#eef4e8]">
              {metric.value}
            </strong>
            <span className="mt-1 block truncate text-[11px] text-[#8d978a]">
              {metric.detail}
            </span>
          </article>
        ))}
      </div>
    </section>
  );
}
