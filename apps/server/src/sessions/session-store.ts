import type {AgentEvent} from "@pixelle/events";

export type Session = {
  id: string;
  createdAt: number;
  events: AgentEvent[];
};

export type SessionStore = {
  create(): Session;
  get(id: string): Session | undefined;
  appendEvents(id: string, events: readonly AgentEvent[]): void;
};

export function createSessionStore(): SessionStore {
  const sessions = new Map<string, Session>();

  return {
    create() {
      const now = Date.now();
      const session: Session = {
        id: `session_${now}`,
        createdAt: now,
        events: [],
      };
      sessions.set(session.id, session);
      return session;
    },
    get(id) {
      return sessions.get(id);
    },
    appendEvents(id, events) {
      const session = sessions.get(id);
      if (!session) {
        return;
      }
      session.events.push(...events);
    },
  };
}
