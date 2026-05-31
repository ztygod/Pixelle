import {
  createAgentRuntime,
  createInMemoryAgentSessionStore,
} from "@pixelle/agent";
import Fastify from "fastify";
import {registerHealthRoutes} from "./routes.health.js";
import {registerSessionRoutes} from "./routes.sessions.js";

export function createServer() {
  const server = Fastify({
    logger: true,
  });
  const sessions = createInMemoryAgentSessionStore();
  const runtime = createAgentRuntime({sessionStore: sessions});

  registerHealthRoutes(server);
  registerSessionRoutes(server, runtime, sessions);

  return server;
}
