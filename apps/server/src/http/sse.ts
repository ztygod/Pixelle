import type {AgentEvent} from "@pixelle/events";
import type {FastifyReply} from "fastify";

export function writeSseHeaders(reply: FastifyReply): void {
  reply.raw.writeHead(200, {
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
  });
}

export function writeSseEvent(reply: FastifyReply, event: AgentEvent): void {
  reply.raw.write(`event: ${event.type}\n`);
  reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
}
