import {loadServerConfig} from "./config.js";
import {createServer} from "./http/create-server.js";

const config = await loadServerConfig();
const server = createServer();

try {
  await server.listen({port: config.port, host: "0.0.0.0"});
  server.log.info(`Pixelle server listening on ${config.port}`);
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
