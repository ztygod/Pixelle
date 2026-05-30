import {create} from "zustand";

export interface RuntimeLogLine {
  level: "info" | "warn" | "error";
  text: string;
  timestamp: number;
}

interface RuntimeLogState {
  lines: RuntimeLogLine[];
  appendLine: (line: RuntimeLogLine) => void;
  clear: () => void;
}

const MAX_RUNTIME_LOG_LINES = 1_000;

export const useRuntimeLogStore = create<RuntimeLogState>((set) => ({
  clear: () => set({lines: []}),
  lines: [],
  appendLine: (line) =>
    set((state) => ({
      lines: [...state.lines, line].slice(-MAX_RUNTIME_LOG_LINES),
    })),
}));
