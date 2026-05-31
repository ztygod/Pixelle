import type {FileNode} from "@/features/file-explorer/model/types";
import {FileTreeNode} from "@/features/file-explorer/ui/FileTreeNode";

interface FileTreeProps {
  expandedFolderPaths: Set<string>;
  nodes: FileNode[];
  onFileOpen?: () => void;
  selectedFilePath: string | null;
}

export function FileTree({
  expandedFolderPaths,
  nodes,
  onFileOpen,
  selectedFilePath,
}: FileTreeProps) {
  if (nodes.length === 0) {
    return (
      <div className="rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
        This folder is empty.
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {nodes.map((node) => (
        <FileTreeNode
          depth={0}
          expandedFolderPaths={expandedFolderPaths}
          key={node.id}
          node={node}
          onFileOpen={onFileOpen}
          selectedFilePath={selectedFilePath}
        />
      ))}
    </div>
  );
}
