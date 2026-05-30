import type {PointerEvent as ReactPointerEvent} from "react";

interface WorkspaceResizeHandleProps {
  label: string;
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>) => void;
}

export function WorkspaceResizeHandle({
  label,
  onPointerDown,
}: WorkspaceResizeHandleProps) {
  return (
    <div
      aria-label={label}
      className="group absolute -right-3 top-2 z-10 hidden h-[calc(100%-1rem)] w-3 cursor-col-resize touch-none items-center justify-center xl:flex"
      onPointerDown={onPointerDown}
      role="separator"
      title={label}
    >
      <span className="h-12 w-px rounded-full bg-[var(--color-border-default)] transition group-hover:bg-[var(--color-accent)]" />
    </div>
  );
}
