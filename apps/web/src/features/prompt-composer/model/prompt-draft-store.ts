import {create} from "zustand";

interface PromptDraftState {
  draft: string;
  setDraft: (draft: string) => void;
  clearDraft: () => void;
}

export const usePromptDraftStore = create<PromptDraftState>((set) => ({
  draft: "",
  clearDraft: () => set({draft: ""}),
  setDraft: (draft) => set({draft}),
}));
