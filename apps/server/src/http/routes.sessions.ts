import type {AgentRuntime, AgentSessionStore} from "@pixelle/agent";
import type {PixelleEvent} from "@pixelle/events";
import type {FastifyInstance} from "fastify";
import {writeSseEvent, writeSseHeaders} from "./sse.js";

type MessageBody = {
  content?: string;
};

export function registerSessionRoutes(
  server: FastifyInstance,
  runtime: AgentRuntime,
  sessions: AgentSessionStore,
): void {
  server.post("/api/sessions", async () => {
    return runtime.createSession();
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

    const events: PixelleEvent[] = [];
    const result = await runtime.submit(
      {
        type: "user_message",
        sessionId,
        content: body.content.trim(),
      },
      {
        emit(event) {
          events.push(event);
        },
      },
    );
    sessions.appendEvents(sessionId, events);

    return {accepted: true, events: result.eventsEmitted};
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
