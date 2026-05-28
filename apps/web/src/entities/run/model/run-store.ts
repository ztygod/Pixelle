import {create} from "zustand";
import type {Run} from "@/entities/run/model/types";

interface RunState {
  activeRunId?: string;
  runsById: Record<string, Run>;
  upsertRun: (run: Run) => void;
}

export const useRunStore = create<RunState>((set) => ({
  runsById: {},
  upsertRun: (run) =>
    set((state) => ({
      activeRunId: run.id,
      runsById: {...state.runsById, [run.id]: run},
    })),
}));
