import {create} from "zustand";

type ThemeMode = "dark" | "light";

interface WorkspaceAppearanceState {
  themeMode: ThemeMode;
  toggleThemeMode: () => void;
}

function getInitialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "dark";
  }

  return window.localStorage.getItem("pixelle-theme") === "light"
    ? "light"
    : "dark";
}

export const useWorkspaceAppearanceStore = create<WorkspaceAppearanceState>(
  (set) => ({
    themeMode: getInitialTheme(),
    toggleThemeMode: () =>
      set((state) => {
        const themeMode = state.themeMode === "dark" ? "light" : "dark";
        window.localStorage.setItem("pixelle-theme", themeMode);
        return {themeMode};
      }),
  }),
);
