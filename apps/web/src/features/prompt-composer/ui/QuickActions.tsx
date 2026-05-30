import {quickActions} from "@/features/prompt-composer/model/quick-actions";

interface QuickActionsProps {
  onSelect: (prompt: string) => void;
}

export function QuickActions({onSelect}: QuickActionsProps) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      {quickActions.map(({description, icon: Icon, title}) => (
        <button
          className="group rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[var(--color-border-default)] hover:bg-[var(--color-surface-elevated)]"
          key={title}
          onClick={() => {
            onSelect(`${title}: ${description}`);
          }}
          type="button"
        >
          <div className="mb-3 grid size-8 place-items-center rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-inset)] text-[var(--color-accent)] transition group-hover:border-[var(--color-accent-border)]">
            <Icon size={16} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">{title}</h3>
          <p className="mt-1 text-xs text-[var(--color-text-tertiary)]">{description}</p>
        </button>
      ))}
    </div>
  );
}
