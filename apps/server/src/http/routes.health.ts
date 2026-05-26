import type {FastifyInstance} from "fastify";

export function registerHealthRoutes(server: FastifyInstance): void {
  server.get("/health", async () => ({
    ok: true,
    service: "pixelle-server",
  }));
}
