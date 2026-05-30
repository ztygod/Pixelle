import {ChevronRight, File, Folder, GitBranch} from "lucide-react";
import type {FileTreeNode} from "@/entities/file";
import {mockProjectTree} from "@/features/project-explorer/model/mock-project-tree";

export function ProjectExplorerSidebar() {
  return (
    <aside className="workspace-panel flex min-h-[360px] w-full flex-col overflow-hidden rounded-lg p-3 xl:h-full xl:min-h-0">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div>
          <p className="mono-label text-[10px] uppercase text-[var(--color-text-tertiary)]">
            Workspace
          </p>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Project Explorer
          </h2>
        </div>
        <span className="rounded-full border border-[var(--color-border-subtle)] px-2 py-1 text-[11px] text-[var(--color-text-tertiary)]">
          4 AI edits
        </span>
      </div>

      <div className="mb-3 flex shrink-0 items-center gap-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2 text-xs text-[var(--color-text-secondary)]">
        <GitBranch size={14} />
        feat/agent-workspace
      </div>

      <nav
        aria-label="Project files"
        className="min-h-0 flex-1 space-y-1 overflow-y-auto pr-1"
      >
        {mockProjectTree.map((node) => (
          <TreeNode key={node.name} node={node} />
        ))}
      </nav>
    </aside>
  );
}

function TreeNode({depth = 0, node}: {depth?: number; node: FileTreeNode}) {
  const Icon = node.type === "folder" ? Folder : File;
  const hasChildren = Boolean(node.children?.length);

  return (
    <div>
      <button
        className={
          node.active
            ? "flex w-full items-center gap-2 rounded-md border border-[var(--color-accent-border)] bg-[var(--color-accent-subtle)] px-2 py-1.5 text-left text-sm text-[var(--color-text-primary)]"
            : "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-[var(--color-text-tertiary)] transition hover:bg-[var(--color-surface-card)] hover:text-[var(--color-text-primary)]"
        }
        style={{paddingLeft: `${8 + depth * 14}px`}}
        type="button"
      >
        {hasChildren ? (
          <ChevronRight className="rotate-90 text-[var(--color-text-disabled)]" size={13} />
        ) : (
          <span className="w-[13px]" />
        )}
        <Icon
          className={node.type === "folder" ? "text-[#7c8cff]" : "text-[var(--color-text-tertiary)]"}
          size={14}
        />
        <span className="min-w-0 flex-1 truncate">{node.name}</span>
        {node.modified ? (
          <span className="mono-label rounded-full bg-[var(--color-accent-subtle)] px-1.5 py-0.5 text-[10px] text-[var(--color-accent)]">
            AI
          </span>
        ) : null}
      </button>
      {node.children?.map((child) => (
        <TreeNode depth={depth + 1} key={child.name} node={child} />
      ))}
    </div>
  );
}
