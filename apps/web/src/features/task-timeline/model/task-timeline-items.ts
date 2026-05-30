export type TaskTimelineState = "done" | "running" | "queued";

export interface TaskTimelineItem {
  label: string;
  title: string;
  description: string;
  state: TaskTimelineState;
}

export const taskTimelineItems: TaskTimelineItem[] = [
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
