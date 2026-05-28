import {Bot, Bug, Circle, FileCode2, GitBranch, Monitor, PieChart} from "lucide-react";

const statusItems = [
  {
    label: "Agent",
    value: "ready",
    icon: Bot,
    tone: "text-[#b7ff55]",
    title: "Agent status: ready",
  },
  {
    label: "File",
    value: "src/app/App.tsx",
    icon: FileCode2,
    tone: "text-[#aeb9a7]",
    title: "Current file: src/app/App.tsx",
  },
  {
    label: "Branch",
    value: "feat/agent-workspace",
    icon: GitBranch,
    tone: "text-[#aeb9a7]",
    title: "Git branch: feat/agent-workspace",
  },
  {
    label: "Diagnostics",
    value: "0 errors",
    icon: Bug,
    tone: "text-[#b7ff55]",
    title: "Diagnostics: 0 errors",
  },
  {
    label: "Context",
    value: "18.4k / 128k",
    icon: PieChart,
    tone: "text-[#aeb9a7]",
    title: "Token context: 18.4k used of 128k",
  },
  {
    label: "Preview",
    value: ":5173",
    icon: Monitor,
    tone: "text-[#b7ff55]",
    title: "Preview server: localhost:5173",
  },
];

export function BottomStatusBar() {
  return (
    <footer className="workspace-panel mt-0 flex h-7 shrink-0 items-center justify-between gap-2 overflow-hidden rounded-md px-2">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overflow-y-hidden">
        {statusItems.map(({icon: Icon, label, title, tone, value}) => (
          <button
            aria-label={title}
            className="mono-label group inline-flex h-5 max-w-[150px] shrink-0 items-center gap-1 rounded px-1.5 text-[10px] text-[#aeb9a7] transition hover:bg-white/[0.055] hover:text-[#f2f5ed] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#b7ff55]/70"
            key={label}
            title={title}
            type="button"
          >
            <Icon className={`${tone} shrink-0`} size={12} />
            <span className="truncate text-[#c8d2c0] group-hover:text-[#f2f5ed]">
              {value}
            </span>
          </button>
        ))}
      </div>
      <button
        aria-label="Runtime heartbeat: active"
        className="mono-label inline-flex h-5 shrink-0 items-center gap-1 rounded px-1.5 text-[10px] text-[#aeb9a7] transition hover:bg-[#b7ff55]/10 hover:text-[#f2f5ed] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#b7ff55]/70"
        title="Runtime heartbeat: active"
        type="button"
      >
        <Circle className="fill-[#b7ff55] text-[#b7ff55]" size={8} />
        runtime: active
      </button>
    </footer>
  );
}
