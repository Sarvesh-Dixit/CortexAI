import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLoggerMiddleware } from './middleware/requestLogger';
import { authRouter } from './routes/auth.routes';
import { compressionRouter } from './routes/compression.routes';
import { documentRouter } from './routes/document.routes';
import { analyticsRouter } from './routes/analytics.routes';
import { settingsRouter } from './routes/settings.routes';
import { playgroundRouter } from './routes/playground.routes';
import { llmRouter } from './routes/llm.routes';
import { ocrRouter } from './routes/ocr.routes';
import { jobsRouter } from './routes/jobs.routes';
import { initQueue } from './queue';

dotenv.config();

const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.AWS_LAMBDA_FUNCTION_NAME);
const isProduction = process.env.NODE_ENV === 'production' || isVercel;

const app = express();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 600 : 9999,
  standardHeaders: true,
  legacyHeaders: false,
});

const isVercelPreviewOrigin = (origin: string): boolean => {
  try {
    const { hostname } = new URL(origin);
    if (hostname === 'localhost') return true;
    if (hostname.endsWith('.vercel.app')) return true;
    if (hostname.endsWith('.railway.app')) return true;
    return false;
  } catch {
    return false;
  }
};

const CORS_MAX_AGE = 86400;

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const explicit = (process.env.CORS_ORIGIN || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (explicit.includes(origin) || isVercelPreviewOrigin(origin)) {
        return callback(null, true);
      }
      if (!isProduction) {
        return callback(null, true);
      }
      logger.warn(`[CORS] Blocking origin: ${origin}`);
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    maxAge: CORS_MAX_AGE,
    exposedHeaders: ['X-Request-ID'],
  })
);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression({ level: 6, threshold: 1024 }));

app.use(express.json({ limit: '200mb' }));
app.use(express.urlencoded({ extended: true, limit: '200mb', parameterLimit: 100_000 }));

app.use(cookieParser());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(limiter);

const DEFAULT_BASE_PATH = isVercel || isProduction ? '' : '/api';
const API_BASE_PATH = (process.env.API_BASE_PATH ?? DEFAULT_BASE_PATH).replace(/\/$/, '');

const mount = (subpath: string, router: any) => {
  const clean = subpath.replace(/^\/+/, '');
  const full = API_BASE_PATH ? `${API_BASE_PATH}/${clean}` : `/${clean}`;
  logger.info(`[Routes] Mounting ${full}`);
  app.use(full, router);
};

mount('auth', authRouter);
mount('compression', compressionRouter);
mount('documents', documentRouter);
mount('analytics', analyticsRouter);
mount('settings', settingsRouter);
mount('playground', playgroundRouter);
mount('llm', llmRouter);
mount('ocr', ocrRouter);
mount('jobs', jobsRouter);

// Initialize background job queue (recover stuck jobs, register handlers)
initQueue().catch((err: unknown) => {
  console.error('[Queue] Failed to initialize:', err);
});

const healthRoute = API_BASE_PATH ? `${API_BASE_PATH}/health` : '/health';
app.get(healthRoute, (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    basePath: API_BASE_PATH,
    isVercel,
    isProduction,
    mountedRoutes: {
      ocrExtract: API_BASE_PATH ? `${API_BASE_PATH}/ocr/extract` : '/ocr/extract',
      ocrCompress: API_BASE_PATH ? `${API_BASE_PATH}/ocr/compress` : '/ocr/compress',
      documentsUpload: API_BASE_PATH ? `${API_BASE_PATH}/documents/upload` : '/documents/upload',
    },
  });
});

app.get('/', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Compression Engine API',
    healthEndpoint: healthRoute,
    basePath: API_BASE_PATH,
    isVercel,
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

app.set('trust proxy', true);

export const config = {
  api: {
    bodyParser: false,
    responseLimit: false,
    externalResolver: true,
  },
  maxDuration: 300,
};

export default app;
export { app, API_BASE_PATH, isVercel, isProduction };
