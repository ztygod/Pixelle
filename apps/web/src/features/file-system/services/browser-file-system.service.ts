import {
  shouldSkipDirectory,
  sortFileNodes,
} from "@/features/file-system/model/file-system.utils";
import type {
  BrowserDirectoryHandle,
  BrowserFileHandle,
  FileNode,
  FileReadResult,
} from "@/features/file-system/model/types";

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

export class FileWriteUnsupportedError extends Error {
  constructor(fileName: string) {
    super(`${fileName} cannot be saved from this browser session.`);
    this.name = "FileWriteUnsupportedError";
  }
}

export async function pickWorkspaceDirectory() {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;

  if (!picker) {
    throw new FileSystemAccessUnsupportedError();
  }

  return picker();
}

export async function readWorkspaceTree(rootHandle: BrowserDirectoryHandle) {
  const fileHandlesByPath: Record<string, BrowserFileHandle> = {};
  const tree = await readDirectory(rootHandle, "", 0, fileHandlesByPath);

  return {tree, fileHandlesByPath};
}

export async function readTextFile(
  path: string,
  handle: BrowserFileHandle,
): Promise<FileReadResult> {
  const file = await handle.getFile();

  if (file.size > MAX_TEXT_FILE_SIZE) {
    throw new FileTooLargeError(file.name);
  }

  return {
    path,
    name: file.name,
    content: await file.text(),
    lastModified: file.lastModified,
    size: file.size,
  };
}

export async function writeTextFile(
  path: string,
  handle: BrowserFileHandle,
  content: string,
) {
  if (!handle.createWritable) {
    throw new FileWriteUnsupportedError(path);
  }

  const writable = await handle.createWritable();

  try {
    await writable.write(content);
  } finally {
    await writable.close();
  }
}

async function readDirectory(
  handle: BrowserDirectoryHandle,
  parentPath: string,
  depth: number,
  fileHandlesByPath: Record<string, BrowserFileHandle>,
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
        children: await readDirectory(entry, path, depth + 1, fileHandlesByPath),
      });
      continue;
    }

    // Keep browser file handles out of the tree so UI nodes stay serializable.
    fileHandlesByPath[path] = entry;
    nodes.push({
      id: path,
      name: entry.name,
      path,
      type: "file",
    });
  }

  return sortFileNodes(nodes);
}
