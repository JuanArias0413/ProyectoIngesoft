import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './shared/logger.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`SGEC server running on http://localhost:${env.PORT} in ${env.NODE_ENV} mode`);
});

function handleShutdown(signal: string) {
  logger.info(`Received ${signal}. Shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed.');
    process.exit(0);
  });
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));
