import * as monaco from "monaco-editor";

const modelUrisByDocumentId = new Map<string, monaco.Uri>();

// Monaco models are view adapters; document content remains in workspace-document.
export function getOrCreateModel(params: {
  documentId: string;
  path: string;
  language?: string;
  content: string;
}) {
  const uri = getModelUri(params.documentId, params.path);
  const existingModel = monaco.editor.getModel(uri);

  if (existingModel) {
    const language = params.language ?? "plaintext";

    if (existingModel.getLanguageId() !== language) {
      monaco.editor.setModelLanguage(existingModel, language);
    }

    return existingModel;
  }

  return monaco.editor.createModel(
    params.content,
    params.language ?? "plaintext",
    uri,
  );
}

function getModelUri(documentId: string, path: string) {
  const existingUri = modelUrisByDocumentId.get(documentId);

  if (existingUri) {
    return existingUri;
  }

  // Stable URIs let Monaco reuse language services and undo stacks per document.
  const uri = monaco.Uri.parse(
    `pixelle://documents/${encodeURIComponent(documentId)}/${encodeURIComponent(
      path,
    )}`,
  );

  modelUrisByDocumentId.set(documentId, uri);
  return uri;
}
