import {quickActions} from "@/features/prompt-composer/model/quick-actions";

interface QuickActionsProps {
  onSelect: (prompt: string) => void;
}

export function QuickActions({onSelect}: QuickActionsProps) {
  return (
    <div className="mb-4 grid gap-2 sm:grid-cols-2">
      {quickActions.map(({description, icon: Icon, title}) => (
        <button
          className="group rounded-lg border border-white/10 bg-white/[0.035] p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#b7ff55]/24 hover:bg-[#b7ff55]/8"
          key={title}
          onClick={() => {
            onSelect(`${title}: ${description}`);
          }}
          type="button"
        >
          <div className="mb-3 grid size-8 place-items-center rounded-md border border-white/10 bg-black/20 text-[#b7ff55] transition group-hover:border-[#b7ff55]/28">
            <Icon size={16} />
          </div>
          <h3 className="text-sm font-semibold text-[#eef4e8]">{title}</h3>
          <p className="mt-1 text-xs text-[#8d978a]">{description}</p>
        </button>
      ))}
    </div>
  );
}
