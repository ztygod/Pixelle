import {Moon, Sun} from "lucide-react";
import {navItems} from "@/widgets/navigation/model/nav-items";

interface NavigationRailProps {
  onToggleTheme: () => void;
  themeMode: "dark" | "light";
}

export function NavigationRail({onToggleTheme, themeMode}: NavigationRailProps) {
  const isLight = themeMode === "light";

  return (
    <nav className="workspace-panel flex min-h-0 shrink-0 flex-row items-center justify-center rounded-lg p-2 xl:h-full xl:flex-col xl:justify-start">
      <div className="hidden size-9 place-items-center rounded-md bg-[#b7ff55] text-sm font-bold text-[#071006] xl:grid">
        px
      </div>
      <div className="flex gap-1 xl:mt-3 xl:flex-col xl:items-center">
        {navItems.map(({active, icon: Icon, label}) => (
          <button
            aria-label={label}
            className={
              active
                ? "grid size-9 place-items-center rounded-md border border-[#b7ff55]/25 bg-[#b7ff55]/12 text-[#b7ff55] shadow-[0_0_24px_rgba(183,255,85,0.12)] transition"
                : "grid size-9 place-items-center rounded-md text-[#808a7a] transition hover:bg-white/[0.06] hover:text-[#f2f5ed]"
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
            ? "mt-auto grid size-9 place-items-center rounded-md border border-[#b7ff55]/30 bg-[#b7ff55]/14 text-[#4d6f16] transition hover:bg-[#b7ff55]/22 xl:mb-2"
            : "mt-auto grid size-9 place-items-center rounded-md text-[#808a7a] transition hover:bg-white/[0.06] hover:text-[#f2f5ed] xl:mb-2"
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
