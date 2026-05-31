export type BrowserFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
  createWritable?: () => Promise<FileSystemWritableFileStream>;
};

export type BrowserDirectoryHandle = {
  kind: "directory";
  name: string;
  values: () => AsyncIterable<BrowserFileHandle | BrowserDirectoryHandle>;
};

export type FileNode = {
  id: string;
  name: string;
  path: string;
  type: "file" | "folder";
  children?: FileNode[];
};

export type FileSystemWorkspace = {
  id: string;
  rootName: string;
  rootHandle: BrowserDirectoryHandle;
  tree: FileNode[];
  // Cached handles let documents switch without rescanning or rereading the tree.
  fileHandlesByPath: Record<string, BrowserFileHandle>;
  openedAt: number;
  refreshedAt: number;
};

export type FileReadResult = {
  path: string;
  name: string;
  content: string;
  lastModified: number;
  size: number;
};
