import type {FileNode} from "@/features/file-explorer/model/types";

const SKIPPED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "build",
  "coverage",
  "dist",
  "node_modules",
  "out",
]);

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  css: "css",
  html: "html",
  js: "javascript",
  json: "json",
  jsx: "javascript",
  md: "markdown",
  ts: "typescript",
  tsx: "typescript",
  txt: "text",
  yml: "yaml",
  yaml: "yaml",
};

export function shouldSkipDirectory(name: string) {
  return SKIPPED_DIRECTORY_NAMES.has(name);
}

export function sortFileNodes(nodes: FileNode[]) {
  return [...nodes].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }

    return a.name.localeCompare(b.name, undefined, {sensitivity: "base"});
  });
}

export function getFileNameFromPath(path: string) {
  return path.split("/").at(-1) ?? path;
}

export function detectLanguage(path: string) {
  const extension = path.split(".").at(-1)?.toLowerCase();

  if (!extension) {
    return undefined;
  }

  return LANGUAGE_BY_EXTENSION[extension];
}
