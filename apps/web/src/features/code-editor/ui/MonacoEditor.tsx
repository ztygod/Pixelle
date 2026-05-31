import {useEffect, useRef} from "react";
import * as monaco from "monaco-editor";
import "@/features/code-editor/model/monaco-workers";
import {getOrCreateModel} from "@/features/code-editor/model/monaco-model-registry";
import {ensurePixelleMonacoTheme} from "@/features/code-editor/model/monaco-theme";

interface MonacoEditorProps {
  documentId: string;
  path: string;
  language?: string;
  value: string;
  viewState?: unknown;
  onChange: (value: string) => void;
  onSave: () => void;
  onViewStateChange: (documentId: string, viewState: unknown) => void;
}

export function MonacoEditor({
  documentId,
  language,
  onChange,
  onSave,
  onViewStateChange,
  path,
  value,
  viewState,
}: MonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const activeDocumentIdRef = useRef<string | null>(null);
  const isApplyingExternalValueRef = useRef(false);
  const latestViewStateRef = useRef(viewState);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);
  const onViewStateChangeRef = useRef(onViewStateChange);

  useEffect(() => {
    latestViewStateRef.current = viewState;
  }, [viewState]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    onViewStateChangeRef.current = onViewStateChange;
  }, [onViewStateChange]);

  useEffect(() => {
    if (!containerRef.current || editorRef.current) {
      return;
    }

    ensurePixelleMonacoTheme();

    // Create Monaco once; recreating it on prop changes can clear the visible model.
    const editor = monaco.editor.create(containerRef.current, {
      automaticLayout: true,
      fontFamily:
        '"JetBrains Mono", "SFMono-Regular", Consolas, "Liberation Mono", monospace',
      fontLigatures: false,
      fontSize: 12,
      lineHeight: 20,
      minimap: {enabled: false},
      padding: {top: 12, bottom: 12},
      renderLineHighlight: "line",
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      tabSize: 2,
      theme: "pixelle-dark",
      wordWrap: "off",
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      onSaveRef.current();
    });

    const changeDisposable = editor.onDidChangeModelContent(() => {
      if (isApplyingExternalValueRef.current) {
        return;
      }

      onChangeRef.current(editor.getValue());
    });

    const viewStateDisposable = editor.onDidBlurEditorWidget(() => {
      const activeDocumentId = activeDocumentIdRef.current;

      if (!activeDocumentId) {
        return;
      }

      onViewStateChangeRef.current(activeDocumentId, editor.saveViewState());
    });

    editorRef.current = editor;

    return () => {
      changeDisposable.dispose();
      viewStateDisposable.dispose();
      editor.dispose();
      editorRef.current = null;
    };
  }, []);

  useEffect(() => {
    const editor = editorRef.current;

    if (!editor) {
      return;
    }

    const previousDocumentId = activeDocumentIdRef.current;

    if (previousDocumentId && previousDocumentId !== documentId) {
      // Save scroll/cursor for the old document before switching models.
      onViewStateChangeRef.current(previousDocumentId, editor.saveViewState());
    }

    const model = getOrCreateModel({
      content: value,
      documentId,
      language,
      path,
    });

    if (editor.getModel() !== model) {
      editor.setModel(model);
    }

    requestAnimationFrame(() => {
      editor.layout();
    });

    if (previousDocumentId !== documentId && latestViewStateRef.current) {
      // Restore view state only on document switches to avoid render loops.
      editor.restoreViewState(
        latestViewStateRef.current as monaco.editor.ICodeEditorViewState,
      );
    }

    activeDocumentIdRef.current = documentId;
  }, [documentId, language, path, value]);

  useEffect(() => {
    const editor = editorRef.current;
    const model = editor?.getModel();

    if (!editor || !model || model.getValue() === value) {
      return;
    }

    // External document updates should not echo back as user edits.
    isApplyingExternalValueRef.current = true;
    model.setValue(value);
    isApplyingExternalValueRef.current = false;
  }, [value]);

  return <div className="h-full min-h-0 w-full" ref={containerRef} />;
}
