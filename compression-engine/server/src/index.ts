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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  exposedHeaders: ['X-Request-ID'],
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(requestIdMiddleware);
app.use(requestLoggerMiddleware);
app.use(limiter);

app.use('/api/auth', authRouter);
app.use('/api/compression', compressionRouter);
app.use('/api/documents', documentRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/playground', playgroundRouter);
app.use('/api/llm', llmRouter);
app.use('/api/ocr', ocrRouter);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});

export default app;
