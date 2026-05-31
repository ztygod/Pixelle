import type {FileNode} from "@/features/file-system/model/types";

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
