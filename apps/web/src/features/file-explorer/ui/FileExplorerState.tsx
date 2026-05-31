import {AlertCircle, LoaderCircle} from "lucide-react";
import {Button} from "@/shared/ui/button";

interface FileExplorerStateProps {
  error: string | null;
  hasFolder: boolean;
  isLoading: boolean;
  onOpenFolder: () => void;
}

export function FileExplorerState({
  error,
  hasFolder,
  isLoading,
  onOpenFolder,
}: FileExplorerStateProps) {
  if (isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-8 text-sm text-[var(--color-text-tertiary)]">
        <LoaderCircle className="mr-2 animate-spin text-[var(--color-accent)]" size={16} />
        Reading folder...
      </div>
    );
  }

  if (!error) {
    return null;
  }

  const containerClassName = hasFolder
    ? "mb-3 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3"
    : "rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-3";

  return (
    <div className={hasFolder ? "" : "min-h-0 flex-1 px-3 py-4"}>
      <div className={containerClassName}>
        <div className="flex items-start gap-2 text-sm text-[var(--color-text-primary)]">
          <AlertCircle className="mt-0.5 shrink-0 text-[var(--color-accent)]" size={16} />
          <div className="min-w-0">
            <p className="font-medium">Could not open folder</p>
            <p className="mt-1 text-xs leading-5 text-[var(--color-text-tertiary)]">
              {error}
            </p>
          </div>
        </div>
        {!hasFolder ? (
          <Button
            className="mt-3"
            onClick={onOpenFolder}
            size="sm"
            type="button"
            variant="outline"
          >
            Try Again
          </Button>
        ) : null}
      </div>
    </div>
  );
}
