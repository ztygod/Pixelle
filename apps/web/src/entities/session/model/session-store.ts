import {create} from "zustand";
import type {Session} from "@/entities/session/model/types";

interface SessionState {
  activeSessionId?: Session["id"];
  sessionsById: Record<string, Session>;
  setActiveSession: (session: Session) => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionsById: {},
  setActiveSession: (session) =>
    set((state) => ({
      activeSessionId: session.id,
      sessionsById: {...state.sessionsById, [String(session.id)]: session},
    })),
}));
