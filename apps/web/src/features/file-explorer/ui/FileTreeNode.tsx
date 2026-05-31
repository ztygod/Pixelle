import {ChevronRight, File, Folder, FolderOpen} from "lucide-react";
import type {FileNode} from "@/features/file-system";
import {useDocumentStore} from "@/entities/workspace-document";
import {useFileExplorerStore} from "@/features/file-explorer/model/file-explorer.store";
import {cn} from "@/shared/lib/cn";

interface FileTreeNodeProps {
  depth: number;
  expandedFolderPaths: Set<string>;
  node: FileNode;
  onFileOpen?: () => void;
  selectedFilePath: string | null;
  workspaceId: string | null;
}

export function FileTreeNode({
  depth,
  expandedFolderPaths,
  node,
  onFileOpen,
  selectedFilePath,
  workspaceId,
}: FileTreeNodeProps) {
  const openDocument = useDocumentStore((state) => state.openDocument);
  const selectFile = useFileExplorerStore((state) => state.selectFile);
  const toggleFolder = useFileExplorerStore((state) => state.toggleFolder);
  const isFolder = node.type === "folder";
  const isExpanded = expandedFolderPaths.has(node.path);
  const isSelected = node.path === selectedFilePath;
  const children = node.children ?? [];
  const hasChildren = children.length > 0;
  const FolderIcon = isExpanded ? FolderOpen : Folder;

  async function handleClick() {
    if (isFolder) {
      toggleFolder(node.path);
      return;
    }

    if (!workspaceId) {
      return;
    }

    selectFile(node.path);
    const openedFile = await openDocument(workspaceId, node.path);

    if (openedFile) {
      onFileOpen?.();
    }
  }

  return (
    <div>
      <button
        className={cn(
          "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition",
          isSelected
            ? "border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]",
        )}
        onClick={handleClick}
        style={{paddingLeft: `${8 + depth * 14}px`}}
        title={node.path}
        type="button"
      >
        {isFolder ? (
          <ChevronRight
            className={cn(
              "shrink-0 text-[var(--color-text-disabled)] transition",
              isExpanded && "rotate-90",
            )}
            size={13}
          />
        ) : (
          <span className="w-[13px] shrink-0" />
        )}
        {isFolder ? (
          <FolderIcon className="shrink-0 text-[var(--color-accent)]" size={14} />
        ) : (
          <File className="shrink-0 text-[var(--color-text-tertiary)]" size={14} />
        )}
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
      </button>

      {isFolder && isExpanded ? (
        hasChildren ? (
          children.map((child) => (
            <FileTreeNode
              depth={depth + 1}
              expandedFolderPaths={expandedFolderPaths}
              key={child.id}
              node={child}
              onFileOpen={onFileOpen}
              selectedFilePath={selectedFilePath}
              workspaceId={workspaceId}
            />
          ))
        ) : (
          <div
            className="px-2 py-1.5 text-xs text-[var(--color-text-disabled)]"
            style={{paddingLeft: `${28 + (depth + 1) * 14}px`}}
          >
            Empty folder
          </div>
        )
      ) : null}
    </div>
  );
}
