import { loadServerConfig } from './config.js';
import { createHttpServer, createRuntime } from './http/server.js';

const config = loadServerConfig();
const runtime = createRuntime(config);
const server = createHttpServer(runtime);

server.listen(config.port, config.host, () => {
  console.log(`omni-qa server listening on http://${config.host}:${config.port}`);
  console.log(`data directory: ${config.dataDir}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`received ${signal}, shutting down omni-qa server`);
  server.close((error) => {
    if (error) {
      console.error(error);
      process.exitCode = 1;
    }
    process.exit();
  });
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
