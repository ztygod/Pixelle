const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  css: "css",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  ts: "typescript",
  tsx: "typescript",
  txt: "plaintext",
  yml: "yaml",
  yaml: "yaml",
};

export function detectLanguage(path: string) {
  const extension = path.split(".").at(-1)?.toLowerCase();

  if (!extension) {
    return undefined;
  }

  return LANGUAGE_BY_EXTENSION[extension];
}

export function getDocumentName(path: string) {
  return path.split("/").at(-1) ?? path;
}
