import Fastify from "fastify";

export function createServer() {
  const server = Fastify({
    logger: true,
  });
  return server;
}
