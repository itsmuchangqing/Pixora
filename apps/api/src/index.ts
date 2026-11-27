import { createApp } from './app.js';
import { env } from './config/env.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`\n  Pixora API running at http://localhost:${env.port}`);
  console.log(`  Health check: http://localhost:${env.port}/api/health\n`);
});

function shutdown(signal: string) {
  console.log(`\nReceived ${signal}, shutting down...`);

  server.close((error) => {
    if (error) {
      console.error('Failed to close the server:', error);
      process.exit(1);
    }
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
