import type {AgentEvent} from "@pixelle/events";
import type {FastifyInstance} from "fastify";
import {createDemoRuntimeEvents} from "../runtime/demo-runtime.js";
import type {SessionStore} from "../sessions/session-store.js";
import {writeSseEvent, writeSseHeaders} from "./sse.js";

type MessageBody = {
  content?: string;
};

export function registerSessionRoutes(
  server: FastifyInstance,
  sessions: SessionStore,
): void {
  server.post("/api/sessions", async () => {
    return sessions.create();
  });

  server.get("/api/sessions/:sessionId", async (request, reply) => {
    const {sessionId} = request.params as {sessionId: string};
    const session = sessions.get(sessionId);
    if (!session) {
      return reply.code(404).send({error: "Session not found"});
    }

    return session;
  });

  server.post("/api/sessions/:sessionId/messages", async (request, reply) => {
    const {sessionId} = request.params as {sessionId: string};
    const body = request.body as MessageBody;
    const session = sessions.get(sessionId);
    if (!session) {
      return reply.code(404).send({error: "Session not found"});
    }
    if (!body.content?.trim()) {
      return reply.code(400).send({error: "Message content is required"});
    }

    const events = createDemoRuntimeEvents(sessionId, body.content.trim());
    sessions.appendEvents(sessionId, events);

    return {accepted: true, events: events.length};
  });

  server.get("/api/sessions/:sessionId/events", async (request, reply) => {
    const {sessionId} = request.params as {sessionId: string};
    const session = sessions.get(sessionId);
    if (!session) {
      return reply.code(404).send({error: "Session not found"});
    }

    writeSseHeaders(reply);
    for (const event of session.events) {
      writeSseEvent(reply, event);
    }
    reply.raw.end();
  });
}
