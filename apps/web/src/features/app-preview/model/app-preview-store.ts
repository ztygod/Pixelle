import {create} from "zustand";

type AppPreviewViewport = "desktop" | "tablet" | "mobile";

interface AppPreviewState {
  url: string;
  viewport: AppPreviewViewport;
  setViewport: (viewport: AppPreviewViewport) => void;
}

export const useAppPreviewStore = create<AppPreviewState>((set) => ({
  setViewport: (viewport) => set({viewport}),
  url: "localhost:5173",
  viewport: "desktop",
}));
