import {create} from "zustand";

export interface ConsoleLine {
  level: "info" | "warn" | "error";
  text: string;
  timestamp: number;
}

interface ConsoleBufferState {
  lines: ConsoleLine[];
  appendLine: (line: ConsoleLine) => void;
  clear: () => void;
}

const MAX_CONSOLE_LINES = 1_000;

export const useConsoleBufferStore = create<ConsoleBufferState>((set) => ({
  clear: () => set({lines: []}),
  lines: [],
  appendLine: (line) =>
    set((state) => ({
      lines: [...state.lines, line].slice(-MAX_CONSOLE_LINES),
    })),
}));
