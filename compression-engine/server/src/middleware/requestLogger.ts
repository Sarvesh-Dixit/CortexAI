/**
 * Request logging middleware.
 * Logs each API request with method, path, status, duration, and request ID.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, originalUrl } = req;
  const requestId = req.requestId || '-';

  res.on('finish', () => {
    const duration = Date.now() - start;
    const { statusCode } = res;
    const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';

    logger.log(level, `[${requestId}] ${method} ${originalUrl} ${statusCode} ${duration}ms`);
  });

  next();
}
