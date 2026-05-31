import {FileCode2, LoaderCircle, Save} from "lucide-react";
import {useCallback} from "react";
import {useDocumentStore} from "@/entities/workspace-document";
import {MonacoEditor} from "@/features/code-editor/ui/MonacoEditor";
import {Button} from "@/shared/ui/button";

export function CodeEditorView() {
  const activeDocumentId = useDocumentStore(
    (state) => state.editor.activeDocumentId,
  );
  const document = useDocumentStore((state) =>
    activeDocumentId ? state.documentsById[activeDocumentId] : null,
  );
  const viewState = useDocumentStore((state) =>
    activeDocumentId
      ? state.editor.editorViewStatesByDocumentId[activeDocumentId]
      : undefined,
  );
  const saveDocument = useDocumentStore((state) => state.saveDocument);
  const setDocumentViewState = useDocumentStore(
    (state) => state.setDocumentViewState,
  );
  const updateDocumentContent = useDocumentStore(
    (state) => state.updateDocumentContent,
  );

  const handleChange = useCallback(
    (value: string) => {
      if (!activeDocumentId) {
        return;
      }

      updateDocumentContent(activeDocumentId, value, "user");
    },
    [activeDocumentId, updateDocumentContent],
  );

  const handleSave = useCallback(() => {
    if (!activeDocumentId) {
      return;
    }

    void saveDocument(activeDocumentId);
  }, [activeDocumentId, saveDocument]);

  const handleViewStateChange = useCallback(
    (documentId: string, nextViewState: unknown) => {
      setDocumentViewState(documentId, nextViewState);
    },
    [setDocumentViewState],
  );

  if (!document) {
    return (
      <div className="grid h-full min-h-0 w-full place-items-center px-4 py-10 text-center">
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

  if (document.loadState === "loading") {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center px-4 py-10 text-sm text-[var(--color-text-tertiary)]">
        <LoaderCircle className="mr-2 animate-spin text-[var(--color-accent)]" size={16} />
        Loading file...
      </div>
    );
  }

  if (document.loadState === "error") {
    return (
      <div className="grid h-full min-h-0 w-full place-items-center px-4 py-10 text-center">
        <div className="max-w-md rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] p-4">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Could not open file
          </h3>
          <p className="mt-2 text-xs leading-5 text-[var(--color-text-tertiary)]">
            {document.error}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <div className="flex shrink-0 items-center gap-2 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2">
        <span className="mono-label min-w-0 truncate text-[11px] text-[var(--color-accent)]">
          {document.path}
        </span>
        {document.isDirty ? (
          <span className="size-1.5 shrink-0 rounded-full bg-[var(--color-accent)]" />
        ) : null}
        {document.language ? (
          <span className="mono-label ml-auto shrink-0 rounded-full border border-[var(--color-border-subtle)] px-2 py-1 text-[10px] text-[var(--color-text-tertiary)]">
            {document.language}
          </span>
        ) : null}
        <Button
          aria-label="Save file"
          disabled={!document.isDirty || document.saveState === "saving"}
          onClick={handleSave}
          size="icon-sm"
          type="button"
          variant="ghost"
        >
          {document.saveState === "saving" ? (
            <LoaderCircle className="animate-spin" size={14} />
          ) : (
            <Save size={14} />
          )}
        </Button>
      </div>
      {document.saveState === "error" ? (
        <div className="shrink-0 border-b border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] px-3 py-2 text-xs text-[var(--color-text-tertiary)]">
          {document.error}
        </div>
      ) : null}
      <div className="min-h-0 w-full flex-1">
        <MonacoEditor
          documentId={document.id}
          language={document.language}
          onChange={handleChange}
          onSave={handleSave}
          onViewStateChange={handleViewStateChange}
          path={document.path}
          value={document.content}
          viewState={viewState}
        />
      </div>
    </div>
  );
}
