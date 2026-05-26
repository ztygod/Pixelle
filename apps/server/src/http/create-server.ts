import Fastify from "fastify";
import {registerHealthRoutes} from "./routes.health.js";
import {registerSessionRoutes} from "./routes.sessions.js";
import {createSessionStore} from "../sessions/session-store.js";

export function createServer() {
  const server = Fastify({
    logger: true,
  });
  const sessions = createSessionStore();

  registerHealthRoutes(server);
  registerSessionRoutes(server, sessions);

  return server;
}
