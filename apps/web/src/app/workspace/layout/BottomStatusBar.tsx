import {Circle, Code2, FileCode2, RadioTower, Wifi} from "lucide-react";

const statusItems = [
  {label: "Agent connected", icon: Wifi, tone: "text-[#b7ff55]"},
  {label: "WebContainer ready", icon: RadioTower, tone: "text-[#b7ff55]"},
  {label: "src/app/App.tsx", icon: FileCode2, tone: "text-[#aeb9a7]"},
  {label: "TypeScript React", icon: Code2, tone: "text-[#aeb9a7]"},
];

export function BottomStatusBar() {
  return (
    <footer className="workspace-panel flex min-h-10 shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2">
      <div className="flex flex-wrap items-center gap-3">
        {statusItems.map(({icon: Icon, label, tone}) => (
          <span
            className="mono-label inline-flex items-center gap-1.5 text-[11px] text-[#aeb9a7]"
            key={label}
          >
            <Icon className={tone} size={13} />
            {label}
          </span>
        ))}
      </div>
      <span className="mono-label inline-flex items-center gap-1.5 text-[11px] text-[#aeb9a7]">
        <Circle className="fill-[#b7ff55] text-[#b7ff55]" size={8} />
        runtime: active
      </span>
    </footer>
  );
}
