import {create} from "zustand";

type PreviewViewport = "desktop" | "tablet" | "mobile";

interface PreviewState {
  url: string;
  viewport: PreviewViewport;
  setViewport: (viewport: PreviewViewport) => void;
}

export const usePreviewStore = create<PreviewState>((set) => ({
  setViewport: (viewport) => set({viewport}),
  url: "localhost:5173",
  viewport: "desktop",
}));
