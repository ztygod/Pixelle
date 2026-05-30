import type {FileTreeNode} from "@/entities/file";

export const mockProjectTree: FileTreeNode[] = [
  {
    name: "src",
    type: "folder",
    children: [
      {
        name: "app",
        type: "folder",
        children: [{name: "App.tsx", type: "file", active: true, modified: true}],
      },
      {
        name: "components",
        type: "folder",
        children: [
          {name: "AgentWorkspace.tsx", type: "file", modified: true},
          {name: "PromptComposer.tsx", type: "file"},
        ],
      },
      {
        name: "styles",
        type: "folder",
        children: [{name: "tokens.css", type: "file", modified: true}],
      },
    ],
  },
  {name: "package.json", type: "file"},
  {name: "vite.config.ts", type: "file"},
];
