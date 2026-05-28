import {create} from "zustand";

type RuntimeStatus = "idle" | "running" | "waiting" | "complete" | "error";

interface RuntimeState {
  detail?: string;
  status: RuntimeStatus;
  setRuntimeStatus: (status: RuntimeStatus, detail?: string) => void;
}

export const useRuntimeStore = create<RuntimeState>((set) => ({
  setRuntimeStatus: (status, detail) => set({detail, status}),
  status: "idle",
}));
