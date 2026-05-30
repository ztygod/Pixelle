import {create} from "zustand";

export interface WorkspaceRegionWidths {
  projectContext: number;
  appPreview: number;
}

interface WorkspaceRegionSizeState {
  regionWidths: WorkspaceRegionWidths;
  setRegionWidth: (
    region: keyof WorkspaceRegionWidths,
    width: number,
  ) => void;
}

export const useWorkspaceRegionSizeStore = create<WorkspaceRegionSizeState>(
  (set) => ({
    regionWidths: {
      projectContext: 260,
      appPreview: 360,
    },
    setRegionWidth: (region, width) =>
      set((state) => ({
        regionWidths: {...state.regionWidths, [region]: width},
      })),
  }),
);
