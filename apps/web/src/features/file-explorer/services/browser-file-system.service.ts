import {
  detectLanguage,
  shouldSkipDirectory,
  sortFileNodes,
} from "@/features/file-explorer/model/file-tree.utils";
import type {
  BrowserDirectoryHandle,
  BrowserFileHandle,
  FileNode,
  OpenedFile,
} from "@/features/file-explorer/model/types";

const MAX_DIRECTORY_DEPTH = 8;
const MAX_TEXT_FILE_SIZE = 2 * 1024 * 1024;

type DirectoryPickerWindow = Window &
  typeof globalThis & {
    showDirectoryPicker?: () => Promise<BrowserDirectoryHandle>;
  };

export class FileSystemAccessUnsupportedError extends Error {
  constructor() {
    super("Your browser does not support opening local folders yet.");
    this.name = "FileSystemAccessUnsupportedError";
  }
}

export class FileTooLargeError extends Error {
  constructor(fileName: string) {
    super(`${fileName} is larger than 2 MB and cannot be previewed yet.`);
    this.name = "FileTooLargeError";
  }
}

export async function openDirectoryTree() {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;

  if (!picker) {
    throw new FileSystemAccessUnsupportedError();
  }

  const rootHandle = await picker();
  const tree = await readDirectory(rootHandle, "", 0);

  return {
    rootName: rootHandle.name,
    tree,
  };
}

export async function readOpenedFile(node: FileNode): Promise<OpenedFile> {
  if (node.type !== "file" || !node.handle || node.handle.kind !== "file") {
    throw new Error("Only file nodes can be opened.");
  }

  const file = await (node.handle as BrowserFileHandle).getFile();

  if (file.size > MAX_TEXT_FILE_SIZE) {
    throw new FileTooLargeError(file.name);
  }

  return {
    path: node.path,
    name: node.name,
    content: await file.text(),
    language: detectLanguage(node.path),
  };
}

async function readDirectory(
  handle: BrowserDirectoryHandle,
  parentPath: string,
  depth: number,
): Promise<FileNode[]> {
  if (depth >= MAX_DIRECTORY_DEPTH) {
    return [];
  }

  const nodes: FileNode[] = [];

  for await (const entry of handle.values()) {
    const path = parentPath ? `${parentPath}/${entry.name}` : entry.name;

    if (entry.kind === "directory") {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      nodes.push({
        id: path,
        name: entry.name,
        path,
        type: "folder",
        children: await readDirectory(entry, path, depth + 1),
        handle: entry,
      });
      continue;
    }

    nodes.push({
      id: path,
      name: entry.name,
      path,
      type: "file",
      handle: entry,
    });
  }

  return sortFileNodes(nodes);
}
