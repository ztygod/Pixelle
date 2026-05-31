import {lazy, Suspense} from "react";
import {LoaderCircle} from "lucide-react";

const CodeEditorView = lazy(() =>
  import("@/features/code-editor").then((module) => ({
    default: module.CodeEditorView,
  })),
);

export function CodeView() {
  return (
    <Suspense
      fallback={
        <div className="flex h-full min-h-0 w-full items-center justify-center px-4 py-10 text-sm text-[var(--color-text-tertiary)]">
          <LoaderCircle className="mr-2 animate-spin text-[var(--color-accent)]" size={16} />
          Loading editor...
        </div>
      }
    >
      <div className="h-full min-h-0 w-full">
        <CodeEditorView />
      </div>
    </Suspense>
  );
}
