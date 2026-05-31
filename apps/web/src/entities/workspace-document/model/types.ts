export type DocumentSource = "user" | "agent" | "git" | "system";

export type DocumentDiffState = {
  mode: "none" | "preview" | "applied" | "conflict";
  baseContent: string;
  proposedContent?: string;
  source: "agent" | "git" | "manual";
};

// The document is the source of truth; Monaco and future agents only mirror it.
export type DocumentModel = {
  id: string;
  workspaceId: string;
  path: string;
  name: string;
  language?: string;
  content: string;
  persistedContent: string;
  version: number;
  persistedVersion: number;
  isDirty: boolean;
  isLoaded: boolean;
  isReadonly: boolean;
  loadState: "idle" | "loading" | "loaded" | "error";
  saveState: "idle" | "saving" | "saved" | "error";
  error: string | null;
  lastReadAt: number | null;
  lastSavedAt: number | null;
  diffState?: DocumentDiffState;
};

// OpenFile tracks tab/editor membership separately from document contents.
export type OpenFile = {
  id: string;
  workspaceId: string;
  path: string;
  documentId: string;
  openedAt: number;
  lastActiveAt: number;
  isPinned: boolean;
  editorViewState?: unknown;
};

// Temporary home for editor view state until multi-tab UI moves it to code-editor.
export type EditorState = {
  activeDocumentId: string | null;
  openFileIds: string[];
  activeDiffId: string | null;
  mode: "editor" | "diff" | "patch-preview";
  focusedEditor: "main" | "diff-original" | "diff-modified" | null;
  editorViewStatesByDocumentId: Record<string, unknown>;
};
