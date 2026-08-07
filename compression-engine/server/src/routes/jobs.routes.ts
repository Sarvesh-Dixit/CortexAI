/**
 * Job Queue Routes.
 *
 * POST /jobs/compress     — Submit a compression job, get jobId immediately
 * POST /jobs/ocr          — Submit an OCR job, get jobId immediately
 * POST /jobs/ocr-compress — Submit OCR+compression, get jobId immediately
 * GET  /jobs/:id          — Poll for job status/progress/result
 * GET  /jobs/:id/stream   — SSE stream for real-time progress updates
 * GET  /jobs              — List user's recent jobs
 */

import { Router, Response, NextFunction, Request } from 'express';
import multer from 'multer';
import { authenticate, AuthRequest } from '../middleware/auth';
import { JobQueue, jobEmitter } from '../queue';
import type { JobProgress } from '../queue';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';

export const jobsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

/**
 * POST /jobs/compress — enqueue compression job
 * Returns jobId immediately (~10ms response time).
 */
jobsRouter.post('/compress', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, level = 'medium', llmProvider = 'openai', documentId, accuracyTarget = 0.95 } = req.body;

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      throw new AppError('Text is required', 400);
    }

    const jobId = await JobQueue.enqueue('compression', req.userId!, {
      userId: req.userId!,
      text,
      level,
      llmProvider,
      documentId,
      accuracyTarget,
    });

    res.status(202).json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        message: 'Compression job submitted. Poll /jobs/:id for progress.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /jobs/ocr — enqueue OCR extraction job
 */
jobsRouter.post('/ocr', authenticate, upload.single('image'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No image uploaded', 400);

    const language = req.body.language || 'eng';

    const jobId = await JobQueue.enqueue('ocr', req.userId!, {
      userId: req.userId!,
      imageBase64: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
      language,
    });

    res.status(202).json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        message: 'OCR job submitted. Poll /jobs/:id for progress.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /jobs/ocr-compress — enqueue OCR + compression
 */
jobsRouter.post('/ocr-compress', authenticate, upload.single('image'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No image uploaded', 400);

    const language = req.body.language || 'eng';
    const level = req.body.level || 'medium';
    const llmProvider = req.body.llmProvider || 'openai';

    const jobId = await JobQueue.enqueue('ocr_compress', req.userId!, {
      userId: req.userId!,
      imageBase64: req.file.buffer.toString('base64'),
      mimeType: req.file.mimetype,
      filename: req.file.originalname,
      language,
      compressionLevel: level,
      llmProvider,
    });

    res.status(202).json({
      success: true,
      data: {
        jobId,
        status: 'queued',
        message: 'OCR+Compression job submitted. Poll /jobs/:id for progress.',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /jobs/:id — poll for job status
 */
jobsRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    const job = await prisma.job.findFirst({
      where: { id, userId: req.userId },
    });

    if (!job) throw new AppError('Job not found', 404);

    let result = undefined;
    if (job.result) {
      try { result = JSON.parse(job.result); } catch { result = null; }
    }

    res.json({
      success: true,
      data: {
        jobId: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        stage: job.stage,
        result,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        createdAt: job.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /jobs/:id/stream — Server-Sent Events for real-time progress
 *
 * The client opens this and receives incremental updates as the job runs:
 *   event: progress
 *   data: { jobId, status, progress, stage }
 *
 * Connection closes when the job completes or fails.
 */
jobsRouter.get('/:id/stream', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Verify the job belongs to this user
    const job = await prisma.job.findFirst({
      where: { id, userId: req.userId },
    });
    if (!job) throw new AppError('Job not found', 404);

    // If already finished, send the final status and close
    if (job.status === 'completed' || job.status === 'failed') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      let result = undefined;
      if (job.result) {
        try { result = JSON.parse(job.result); } catch { /* ignore */ }
      }

      const payload: JobProgress = {
        jobId: id,
        status: job.status as any,
        progress: job.progress,
        stage: job.stage,
        result,
        error: job.error ?? undefined,
      };

      res.write(`event: ${job.status}\n`);
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
      res.end();
      return;
    }

    // Set up SSE connection
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    // Send initial state
    res.write(`event: progress\ndata: ${JSON.stringify({
      jobId: id, status: job.status, progress: job.progress, stage: job.stage,
    })}\n\n`);

    // Subscribe to progress events
    const listener = (update: JobProgress) => {
      const event = update.status === 'completed' || update.status === 'failed'
        ? update.status
        : 'progress';
      res.write(`event: ${event}\ndata: ${JSON.stringify(update)}\n\n`);

      // Close connection when done
      if (update.status === 'completed' || update.status === 'failed') {
        jobEmitter.removeListener(id, listener);
        res.end();
      }
    };

    jobEmitter.on(id, listener);

    // Clean up if client disconnects
    req.on('close', () => {
      jobEmitter.removeListener(id, listener);
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /jobs — list recent jobs for the current user
 */
jobsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = '20', status } = req.query;

    const where: Record<string, unknown> = { userId: req.userId };
    if (status && typeof status === 'string') {
      where.status = status;
    }

    const jobs = await prisma.job.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      select: {
        id: true,
        type: true,
        status: true,
        progress: true,
        stage: true,
        error: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: jobs });
  } catch (error) {
    next(error);
  }
});
