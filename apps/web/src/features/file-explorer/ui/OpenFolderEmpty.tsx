import {FolderOpen} from "lucide-react";
import {Button} from "@/shared/ui/button";

interface OpenFolderEmptyProps {
  isLoading: boolean;
  onOpenFolder: () => void;
}

export function OpenFolderEmpty({
  isLoading,
  onOpenFolder,
}: OpenFolderEmptyProps) {
  return (
    <div className="grid min-h-0 flex-1 place-items-center px-3 py-8 text-center">
      <div className="max-w-[220px]">
        <div className="mx-auto mb-4 grid size-10 place-items-center rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-accent)]">
          <FolderOpen size={18} />
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          No folder open
        </h3>
        <p className="mt-2 text-xs leading-5 text-[var(--color-text-tertiary)]">
          Open a local project folder to browse files in this workspace.
        </p>
        <Button
          className="mt-4 w-full"
          disabled={isLoading}
          onClick={onOpenFolder}
          size="sm"
          type="button"
          variant="default"
        >
          <FolderOpen size={14} />
          {isLoading ? "Opening..." : "Open Folder"}
        </Button>
      </div>
    </div>
  );
}
