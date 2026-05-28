import {create} from "zustand";

export interface PanelWidths {
  explorer: number;
  preview: number;
}

interface DockLayoutState {
  panelWidths: PanelWidths;
  setPanelWidth: (panel: keyof PanelWidths, width: number) => void;
}

export const useDockLayoutStore = create<DockLayoutState>((set) => ({
  panelWidths: {
    explorer: 260,
    preview: 360,
  },
  setPanelWidth: (panel, width) =>
    set((state) => ({
      panelWidths: {...state.panelWidths, [panel]: width},
    })),
}));
