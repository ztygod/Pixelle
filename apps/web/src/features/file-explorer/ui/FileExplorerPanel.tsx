import {FolderOpen} from "lucide-react";
import {Button} from "@/shared/ui/button";
import {useFileExplorerStore} from "@/features/file-explorer/model/file-explorer.store";
import {FileExplorerState} from "@/features/file-explorer/ui/FileExplorerState";
import {FileTree} from "@/features/file-explorer/ui/FileTree";
import {OpenFolderEmpty} from "@/features/file-explorer/ui/OpenFolderEmpty";

interface FileExplorerPanelProps {
  onFileOpen?: () => void;
}

export function FileExplorerPanel({onFileOpen}: FileExplorerPanelProps) {
  const rootName = useFileExplorerStore((state) => state.rootName);
  const tree = useFileExplorerStore((state) => state.tree);
  const selectedFilePath = useFileExplorerStore((state) => state.selectedFilePath);
  const expandedFolderPaths = useFileExplorerStore(
    (state) => state.expandedFolderPaths,
  );
  const isLoading = useFileExplorerStore((state) => state.isLoading);
  const error = useFileExplorerStore((state) => state.error);
  const openFolder = useFileExplorerStore((state) => state.openFolder);
  const hasFolder = Boolean(rootName);

  return (
    <aside className="workspace-panel flex min-h-[360px] w-full flex-col overflow-hidden rounded-lg p-3 xl:h-full xl:min-h-0">
      <div className="mb-3 flex shrink-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="mono-label text-[10px] uppercase text-[var(--color-text-tertiary)]">
            Workspace
          </p>
          <h2 className="truncate text-sm font-semibold text-[var(--color-text-primary)]">
            File Explorer
          </h2>
        </div>
        {hasFolder ? (
          <Button
            aria-label="Open folder"
            disabled={isLoading}
            onClick={openFolder}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <FolderOpen size={15} />
          </Button>
        ) : null}
      </div>

      {hasFolder ? (
        <div className="mb-3 flex shrink-0 items-center gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
          <FolderOpen className="shrink-0 text-[var(--color-accent)]" size={14} />
          <span className="min-w-0 truncate">{rootName}</span>
        </div>
      ) : null}

      <FileExplorerState
        error={error}
        hasFolder={hasFolder}
        isLoading={isLoading}
        onOpenFolder={openFolder}
      />

      {!hasFolder && !isLoading && !error ? (
        <OpenFolderEmpty isLoading={isLoading} onOpenFolder={openFolder} />
      ) : null}

      {hasFolder && !isLoading ? (
        <nav
          aria-label="Workspace files"
          className="min-h-0 flex-1 overflow-y-auto pr-1"
        >
          <FileTree
            expandedFolderPaths={expandedFolderPaths}
            nodes={tree}
            onFileOpen={onFileOpen}
            selectedFilePath={selectedFilePath}
          />
        </nav>
      ) : null}
    </aside>
  );
}
