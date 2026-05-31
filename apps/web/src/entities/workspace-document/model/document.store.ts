import {create} from "zustand";
import {useFileSystemStore} from "@/features/file-system";
import {
  detectLanguage,
  getDocumentName,
} from "@/entities/workspace-document/model/language.utils";
import type {
  DocumentModel,
  DocumentSource,
  EditorState,
  OpenFile,
} from "@/entities/workspace-document/model/types";

interface DocumentState {
  documentsById: Record<string, DocumentModel>;
  openFilesById: Record<string, OpenFile>;
  editor: EditorState;
}

interface DocumentActions {
  openDocument: (
    workspaceId: string,
    path: string,
  ) => Promise<DocumentModel | null>;
  updateDocumentContent: (
    documentId: string,
    content: string,
    source?: DocumentSource,
  ) => void;
  saveDocument: (documentId: string) => Promise<boolean>;
  setActiveDocument: (documentId: string) => void;
  setDocumentViewState: (documentId: string, viewState: unknown) => void;
}

const initialEditorState: EditorState = {
  activeDocumentId: null,
  openFileIds: [],
  activeDiffId: null,
  mode: "editor",
  focusedEditor: null,
  editorViewStatesByDocumentId: {},
};

export const useDocumentStore = create<DocumentState & DocumentActions>(
  (set, get) => ({
    documentsById: {},
    openFilesById: {},
    editor: initialEditorState,
    openDocument: async (workspaceId, path) => {
      const documentId = getDocumentId(workspaceId, path);
      const existingDocument = get().documentsById[documentId];

      if (existingDocument?.isLoaded) {
        // Reuse cached document content instead of rereading the file on every switch.
        get().setActiveDocument(documentId);
        return existingDocument;
      }

      const now = Date.now();

      set((state) => ({
        documentsById: {
          ...state.documentsById,
          [documentId]: existingDocument ?? createLoadingDocument(workspaceId, path),
        },
      }));

      try {
        const file = await useFileSystemStore
          .getState()
          .readFile(workspaceId, path);
        const document = createLoadedDocument(
          workspaceId,
          path,
          file.content,
          now,
        );
        const openFile = createOpenFile(workspaceId, path, documentId, now);

        set((state) => ({
          documentsById: {
            ...state.documentsById,
            [documentId]: document,
          },
          editor: {
            ...state.editor,
            activeDocumentId: documentId,
            mode: "editor",
            openFileIds: addUnique(state.editor.openFileIds, openFile.id),
          },
          openFilesById: {
            ...state.openFilesById,
            [openFile.id]: openFile,
          },
        }));

        return document;
      } catch (error) {
        set((state) => ({
          documentsById: {
            ...state.documentsById,
            [documentId]: {
              ...(state.documentsById[documentId] ??
                createLoadingDocument(workspaceId, path)),
              error: getErrorMessage(error),
              isLoaded: false,
              loadState: "error",
            },
          },
        }));
        return null;
      }
    },
    saveDocument: async (documentId) => {
      const document = get().documentsById[documentId];

      if (!document || document.isReadonly) {
        return false;
      }

      set((state) => ({
        documentsById: {
          ...state.documentsById,
          [documentId]: {
            ...document,
            error: null,
            saveState: "saving",
          },
        },
      }));

      try {
        await useFileSystemStore
          .getState()
          .writeFile(document.workspaceId, document.path, document.content);

        set((state) => {
          const latest = state.documentsById[documentId];

          if (!latest) {
            return state;
          }

          return {
            documentsById: {
              ...state.documentsById,
              [documentId]: {
                ...latest,
                error: null,
                isDirty: false,
                persistedContent: latest.content,
                persistedVersion: latest.version,
                saveState: "saved",
                lastSavedAt: Date.now(),
              },
            },
          };
        });

        return true;
      } catch (error) {
        set((state) => {
          const latest = state.documentsById[documentId];

          if (!latest) {
            return state;
          }

          return {
            documentsById: {
              ...state.documentsById,
              [documentId]: {
                ...latest,
                error: getErrorMessage(error),
                saveState: "error",
              },
            },
          };
        });

        return false;
      }
    },
    setActiveDocument: (documentId) =>
      set((state) => {
        const openFile = state.openFilesById[documentId];

        return {
          editor: {
            ...state.editor,
            activeDocumentId: documentId,
            mode: "editor",
            openFileIds: addUnique(state.editor.openFileIds, documentId),
          },
          openFilesById: openFile
            ? {
                ...state.openFilesById,
                [documentId]: {
                  ...openFile,
                  lastActiveAt: Date.now(),
                },
              }
            : state.openFilesById,
        };
      }),
    setDocumentViewState: (documentId, viewState) =>
      set((state) => ({
        editor: {
          ...state.editor,
          editorViewStatesByDocumentId: {
            ...state.editor.editorViewStatesByDocumentId,
            [documentId]: viewState,
          },
        },
      })),
    updateDocumentContent: (documentId, content) =>
      set((state) => {
        const document = state.documentsById[documentId];

        if (!document || document.content === content) {
          return state;
        }

        const version = document.version + 1;

        return {
          documentsById: {
            ...state.documentsById,
            [documentId]: {
              ...document,
              content,
              error: null,
              // Dirty is derived from the persisted snapshot, not Monaco state.
              isDirty: content !== document.persistedContent,
              saveState:
                content === document.persistedContent
                  ? "saved"
                  : document.saveState === "saving"
                    ? "saving"
                    : "idle",
              version,
            },
          },
        };
      }),
  }),
);

export function getDocumentId(workspaceId: string, path: string) {
  return `${workspaceId}:${path}`;
}

function createLoadingDocument(
  workspaceId: string,
  path: string,
): DocumentModel {
  return {
    id: getDocumentId(workspaceId, path),
    workspaceId,
    path,
    name: getDocumentName(path),
    language: detectLanguage(path),
    content: "",
    persistedContent: "",
    version: 0,
    persistedVersion: 0,
    isDirty: false,
    isLoaded: false,
    isReadonly: false,
    loadState: "loading",
    saveState: "idle",
    error: null,
    lastReadAt: null,
    lastSavedAt: null,
    diffState: {mode: "none", baseContent: "", source: "manual"},
  };
}

function createLoadedDocument(
  workspaceId: string,
  path: string,
  content: string,
  timestamp: number,
): DocumentModel {
  return {
    ...createLoadingDocument(workspaceId, path),
    content,
    persistedContent: content,
    isLoaded: true,
    loadState: "loaded",
    saveState: "saved",
    lastReadAt: timestamp,
  };
}

function createOpenFile(
  workspaceId: string,
  path: string,
  documentId: string,
  timestamp: number,
): OpenFile {
  return {
    id: documentId,
    workspaceId,
    path,
    documentId,
    openedAt: timestamp,
    lastActiveAt: timestamp,
    isPinned: true,
  };
}

function addUnique(items: string[], item: string) {
  return items.includes(item) ? items : [...items, item];
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong while reading the file.";
}
