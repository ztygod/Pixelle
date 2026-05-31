import {FileCode2} from "lucide-react";
import {useFileExplorerStore} from "@/features/file-explorer";

export function CodeView() {
  const activeFilePath = useFileExplorerStore((state) => state.activeFilePath);
  const openedFiles = useFileExplorerStore((state) => state.openedFiles);
  const activeFile = openedFiles.find((file) => file.path === activeFilePath);

  if (!activeFile) {
    return (
      <div className="grid min-h-full place-items-center px-4 py-10 text-center">
        <div className="max-w-sm">
          <div className="mx-auto mb-4 grid size-10 place-items-center rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
            <FileCode2 size={18} />
          </div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            No file selected
          </h3>
          <p className="mt-2 text-sm leading-6 text-[var(--color-text-tertiary)]">
            Open a folder and select a file to preview its source here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2">
        <span className="mono-label min-w-0 truncate text-[11px] text-[var(--color-accent)]">
          {activeFile.path}
        </span>
        {activeFile.language ? (
          <span className="mono-label ml-auto shrink-0 rounded-full border border-[var(--color-border-subtle)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)]">
            {activeFile.language}
          </span>
        ) : null}
      </div>
      <pre className="min-h-0 flex-1 overflow-auto bg-[var(--color-surface-inset)] p-4 text-xs leading-5 text-[var(--color-text-secondary)]">
        <code>{activeFile.content}</code>
      </pre>
    </div>
  );
}
