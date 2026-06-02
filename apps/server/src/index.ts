import {defaultPixelleConfig} from "./config.js";
import {createServer} from "./http/create-server.js";

const port = Number(process.env.PORT ?? defaultPixelleConfig.serverPort);
const server = createServer();

try {
  await server.listen({port, host: "0.0.0.0"});
  server.log.info(`Pixelle server listening on ${port}`);
} catch (error) {
  server.log.error(error);
  process.exitCode = 1;
}
