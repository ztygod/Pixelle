import {Check, Circle, Loader2} from "lucide-react";
import {cn} from "@/shared/lib/cn";
import {
  taskTimelineItems,
  type TaskTimelineState,
} from "@/features/task-timeline/model/task-timeline-items";

interface TaskTimelineProps {
  visible: boolean;
}

export function TaskTimeline({visible}: TaskTimelineProps) {
  return (
    <section
      aria-hidden={!visible}
      className={cn(
        "shrink-0 overflow-hidden border-t border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] transition-all duration-300 ease-out",
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
          <p className="mono-label text-[10px] uppercase text-[var(--color-text-tertiary)]">
            Agent Timeline
          </p>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Current execution
          </h2>
        </div>
        <span className="mono-label rounded-full border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-2.5 py-1 text-[11px] text-[var(--color-accent)]">
          running
        </span>
      </div>
      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 md:grid-cols-4 xl:max-h-48">
        {taskTimelineItems.map((item) => (
          <article
            className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3"
            key={item.label}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="mono-label text-[10px] uppercase text-[var(--color-text-tertiary)]">
                {item.label}
              </span>
              <StateIcon state={item.state} />
            </div>
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">{item.title}</h3>
            <p className="mt-2 text-xs leading-5 text-[var(--color-text-tertiary)]">
              {item.description}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

function StateIcon({state}: {state: TaskTimelineState}) {
  if (state === "done") {
    return (
      <span className="grid size-6 place-items-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
        <Check size={13} />
      </span>
    );
  }

  if (state === "running") {
    return (
      <span className="grid size-6 place-items-center rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
        <Loader2 className="animate-spin" size={13} />
      </span>
    );
  }

  return (
    <span className="grid size-6 place-items-center rounded-full bg-[var(--color-surface-card)] text-[var(--color-text-disabled)]">
      <Circle size={10} />
    </span>
  );
}
