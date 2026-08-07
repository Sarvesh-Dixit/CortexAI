import dotenv from 'dotenv';
import { app, API_BASE_PATH, isVercel } from './app';
import { logger } from './utils/logger';

dotenv.config();

const PORT = process.env.PORT || 3001;

if (isVercel) {
  logger.info('[Server] Running in Vercel serverless mode; skipping local listener.');
} else {
  const server = app.listen(PORT, () => {
    logger.info(`Server running on port ${PORT} (basePath=${API_BASE_PATH || '/'})`);
  });

  const SERVER_TIMEOUT_MS = 20 * 60 * 1000;
  const KEEP_ALIVE_MS = 61 * 1000;
  const HEADERS_TIMEOUT_MS = 65 * 1000;

  server.timeout = SERVER_TIMEOUT_MS;
  server.keepAliveTimeout = KEEP_ALIVE_MS;
  server.headersTimeout = HEADERS_TIMEOUT_MS;

  server.on('timeout', (socket) => {
    logger.warn('[Server] Connection timed out');
    socket.destroy(new Error('Server connection timeout'));
  });

  process.on('uncaughtException', (err) => {
    logger.error('[Server] Uncaught exception', err);
  });
  process.on('unhandledRejection', (reason) => {
    logger.error('[Server] Unhandled rejection', reason instanceof Error ? reason : new Error(String(reason)));
  });
}
