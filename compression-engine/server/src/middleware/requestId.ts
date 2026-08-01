/**
 * Request ID middleware.
 * Attaches a unique request ID to each request for tracing and correlation.
 */

import { Request, Response, NextFunction } from 'express';
import { v4 as uuid } from 'uuid';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  const requestId = (typeof incoming === 'string' && incoming.length > 0)
    ? incoming
    : uuid();

  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);

  next();
}
