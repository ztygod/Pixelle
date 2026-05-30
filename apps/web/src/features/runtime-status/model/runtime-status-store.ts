import {create} from "zustand";

type RuntimeStatus = "idle" | "running" | "waiting" | "complete" | "error";

interface RuntimeStatusState {
  detail?: string;
  status: RuntimeStatus;
  setRuntimeStatus: (status: RuntimeStatus, detail?: string) => void;
}

export const useRuntimeStatusStore = create<RuntimeStatusState>((set) => ({
  setRuntimeStatus: (status, detail) => set({detail, status}),
  status: "idle",
}));
