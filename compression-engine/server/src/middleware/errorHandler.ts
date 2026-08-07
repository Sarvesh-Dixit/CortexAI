import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export class AppError extends Error {
  statusCode: number;
  errorCode: string;
  isOperational: boolean;

  constructor(message: string, statusCode: number, errorCode?: string) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode || AppError.codeForStatus(statusCode);
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  private static codeForStatus(status: number): string {
    if (status === 400) return 'validation_error';
    if (status === 401) return 'unauthorized';
    if (status === 403) return 'forbidden';
    if (status === 404) return 'not_found';
    if (status === 409) return 'conflict';
    if (status === 429) return 'rate_limit_exceeded';
    return 'internal_error';
  }
}

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (value && value.trim().length > 0) return value;
  throw new AppError(
    `Missing required environment variable: ${name}. ` +
    `If deploying on Vercel, add it in Project Settings → Environment Variables. ` +
    `See .env.example for details.`,
    500,
    'missing_env'
  );
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = (err as AppError).statusCode || 500;
  const errorCode = (err as AppError).errorCode || 'internal_error';
  const message = err.message || 'Internal Server Error';
  const requestId = req.requestId || '-';
  const timestamp = new Date().toISOString();

  logger.error(`[${requestId}] ${statusCode} ${errorCode} - ${message}\n${err.stack || ''}`);

  res.status(statusCode).json({
    success: false,
    error: {
      status: statusCode,
      code: errorCode,
      message,
      timestamp,
      requestId,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}
