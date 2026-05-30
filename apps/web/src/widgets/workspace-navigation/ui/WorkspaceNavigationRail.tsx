import {Moon, Sun} from "lucide-react";
import {workspaceNavItems} from "@/widgets/workspace-navigation/model/workspace-nav-items";

interface WorkspaceNavigationRailProps {
  onToggleTheme: () => void;
  themeMode: "dark" | "light";
}

export function WorkspaceNavigationRail({
  onToggleTheme,
  themeMode,
}: WorkspaceNavigationRailProps) {
  const isLight = themeMode === "light";

  return (
    <nav className="workspace-panel flex min-h-0 shrink-0 flex-row items-center justify-center rounded-lg p-2 xl:h-full xl:flex-col xl:justify-start">
      <div className="hidden size-9 place-items-center rounded-md bg-[var(--color-accent)] text-sm font-bold text-[var(--color-accent-foreground)] xl:grid">
        px
      </div>
      <div className="flex gap-1 xl:mt-3 xl:flex-col xl:items-center">
        {workspaceNavItems.map(({active, icon: Icon, label}) => (
          <button
            aria-label={label}
            className={
              active
                ? "grid size-9 place-items-center rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)] shadow-[var(--shadow-card)] transition"
                : "grid size-9 place-items-center rounded-md text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
            }
            key={label}
            title={label}
            type="button"
          >
            <Icon size={17} />
          </button>
        ))}
      </div>
      <button
        aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
        className={
          isLight
            ? "mt-auto grid size-9 place-items-center rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent-active)] transition hover:bg-[var(--color-accent-subtle)] xl:mb-2"
            : "mt-auto grid size-9 place-items-center rounded-md text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)] xl:mb-2"
        }
        onClick={onToggleTheme}
        title={isLight ? "Switch to dark mode" : "Switch to light mode"}
        type="button"
      >
        {isLight ? <Moon size={17} /> : <Sun size={17} />}
      </button>
    </nav>
  );
}
