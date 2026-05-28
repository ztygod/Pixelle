import {
  Box,
  Bug,
  Files,
  GitBranch,
  MessageSquare,
  Package,
  Puzzle,
  RefreshCw,
  Settings,
  Sparkles,
} from "lucide-react";
import type {
  FileTreeNode,
  NavItem,
  QuickAction,
  TimelineItem,
} from "../types";

export const navItems: NavItem[] = [
  {label: "Chat", icon: MessageSquare, active: true},
  {label: "Files", icon: Files},
  {label: "Git", icon: GitBranch},
  {label: "Sandbox", icon: Box},
  {label: "Plugins", icon: Puzzle},
  {label: "Settings", icon: Settings},
];

export const fileTree: FileTreeNode[] = [
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
          {name: "WorkspaceShell.tsx", type: "file", modified: true},
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

export const quickActions: QuickAction[] = [
  {
    title: "生成登录页",
    description: "Create a polished auth flow",
    icon: Sparkles,
  },
  {
    title: "修复错误",
    description: "Read logs and patch the issue",
    icon: Bug,
  },
  {
    title: "重构组件",
    description: "Extract clean UI boundaries",
    icon: RefreshCw,
  },
  {
    title: "添加功能",
    description: "Plan, edit, run, verify",
    icon: Package,
  },
];

export const timelineItems: TimelineItem[] = [
  {
    label: "思考",
    title: "理解目标与当前代码结构",
    description: "Pixelle is mapping the request into a scoped implementation plan.",
    state: "done",
  },
  {
    label: "任务",
    title: "生成 workspace 首页组件",
    description: "Splitting navigation, explorer, agent timeline, preview and runtime panels.",
    state: "running",
  },
  {
    label: "工具",
    title: "Run project checks",
    description: "Build and preview verification will run after the patch is ready.",
    state: "queued",
  },
  {
    label: "结果",
    title: "Deliver interactive static workspace",
    description: "A calm AI-native coding surface ready for runtime integration.",
    state: "queued",
  },
];
