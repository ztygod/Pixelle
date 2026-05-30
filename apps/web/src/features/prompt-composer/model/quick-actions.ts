import {Bug, Package, RefreshCw, Sparkles} from "lucide-react";
import type {LucideIcon} from "lucide-react";

export interface QuickAction {
  title: string;
  description: string;
  icon: LucideIcon;
}

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
