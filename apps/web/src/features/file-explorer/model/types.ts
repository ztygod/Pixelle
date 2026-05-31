export type BrowserFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
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
  handle?: BrowserFileHandle | BrowserDirectoryHandle;
};

export type OpenedFile = {
  path: string;
  name: string;
  content: string;
  language?: string;
};

export type FileExplorerState = {
  rootName: string | null;
  tree: FileNode[];
  selectedFilePath: string | null;
  openedFiles: OpenedFile[];
  activeFilePath: string | null;
  expandedFolderPaths: Set<string>;
  isLoading: boolean;
  error: string | null;
};
