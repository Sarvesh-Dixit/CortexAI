/**
 * In-process Job Queue with Prisma persistence and SSE broadcasting.
 * All in one file for simplicity.
 */

import { EventEmitter } from 'events';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export type JobType = 'compression' | 'ocr' | 'ocr_compress';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed';

export interface JobProgress {
  jobId: string;
  status: JobStatus;
  progress: number;
  stage: string;
  result?: unknown;
  error?: string;
}

export type JobHandler = (
  input: unknown,
  onProgress: (progress: number, stage: string) => Promise<void>
) => Promise<unknown>;

export const jobEmitter = new EventEmitter();
jobEmitter.setMaxListeners(500);

const MAX_CONCURRENCY = 2;
let running = 0;
const handlers = new Map<JobType, JobHandler>();

async function emit(jobId: string, update: Partial<JobProgress>): Promise<void> {
  jobEmitter.emit(jobId, { jobId, status: 'running', progress: 0, stage: '', ...update });
}

async function processNext(): Promise<void> {
  if (running >= MAX_CONCURRENCY) return;

  const job = await prisma.job.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return;

  running++;

  await prisma.job.update({
    where: { id: job.id },
    data: { status: 'running', startedAt: new Date(), stage: 'starting', progress: 0 },
  });
  await emit(job.id, { status: 'running', progress: 0, stage: 'starting' });

  const handler = handlers.get(job.type as JobType);
  if (!handler) {
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'failed', stage: 'failed', error: `No handler for: ${job.type}`, completedAt: new Date() },
    });
    await emit(job.id, { status: 'failed', error: `No handler for: ${job.type}` });
    running--;
    setImmediate(processNext);
    return;
  }

  logger.info(`[Queue] Processing job ${job.id} (type=${job.type})`);

  try {
    const input = JSON.parse(job.input);
    const result = await handler(input, async (progress, stage) => {
      await prisma.job.update({ where: { id: job.id }, data: { progress, stage } });
      await emit(job.id, { status: 'running', progress, stage });
    });

    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'completed', progress: 100, stage: 'completed', result: JSON.stringify(result), completedAt: new Date() },
    });
    await emit(job.id, { status: 'completed', progress: 100, stage: 'completed', result });
    logger.info(`[Queue] Job ${job.id} completed`);
  } catch (error: any) {
    const msg = error?.message || String(error);
    await prisma.job.update({
      where: { id: job.id },
      data: { status: 'failed', stage: 'failed', error: msg, completedAt: new Date() },
    });
    await emit(job.id, { status: 'failed', error: msg });
    logger.error(`[Queue] Job ${job.id} failed: ${msg}`);
  } finally {
    running--;
    setImmediate(processNext);
  }
}

export const JobQueue = {
  register(type: JobType, handler: JobHandler): void {
    handlers.set(type, handler);
  },

  async enqueue(type: JobType, userId: string, input: unknown): Promise<string> {
    const job = await prisma.job.create({
      data: { userId, type, input: JSON.stringify(input), status: 'queued', stage: 'queued', progress: 0 },
    });
    setImmediate(processNext);
    return job.id;
  },

  async recoverStuckJobs(): Promise<void> {
    const { count } = await prisma.job.updateMany({
      where: { status: 'running' },
      data: { status: 'queued', stage: 'queued', progress: 0, startedAt: null },
    });
    if (count > 0) {
      logger.warn(`[Queue] Recovered ${count} stuck jobs`);
      setImmediate(processNext);
    }
  },
};

// ─── Handler imports (inline to avoid circular deps) ─────────────────────

import { SupervisorAgent } from '../agents';
import { CompressionLevel } from '../agents/types';
import { v4 as uuid } from 'uuid';
import { ActivityLogService } from '../services/activity-log.service';

const supervisor = new SupervisorAgent();

// Compression handler
const compressionHandler: JobHandler = async (rawInput, onProgress) => {
  const input = rawInput as any;
  await onProgress(5, 'Starting pipeline');

  const result = await supervisor.orchestrate({
    text: input.text,
    userId: input.userId,
    compressionLevel: input.level as CompressionLevel,
    llmProvider: input.llmProvider,
    filename: input.filename,
    accuracyTarget: input.accuracyTarget ?? 0.95,
  });

  if (result.status === 'failed') throw new Error(result.error || 'Pipeline failed');

  await onProgress(85, 'Saving results');

  const analytics = result.analytics!;
  const compression = await prisma.compression.create({
    data: {
      id: result.id,
      userId: input.userId,
      documentId: input.documentId || null,
      originalText: input.text,
      compressedText: result.compressedText,
      originalTokens: analytics.originalTokens,
      compressedTokens: analytics.compressedTokens,
      compressionRatio: analytics.compressionRatio,
      semanticScore: analytics.semanticScore,
      compressionLevel: result.compressionLevel as string,
      requestedLevel: input.level as string,
      llmProvider: input.llmProvider,
      documentType: result.documentType,
      language: result.detectedLanguage,
      originalCost: analytics.originalCost,
      compressedCost: analytics.compressedCost,
      costSavings: analytics.costSavings,
      latencyOriginalMs: analytics.originalTokens * 0.05,
      latencyCompressedMs: analytics.compressedTokens * 0.05,
      latencyImprovement: analytics.latencyImprovement,
      processingTimeMs: result.totalExecutionTimeMs,
      accuracyTarget: input.accuracyTarget ?? 0.95,
      metTarget: analytics.semanticScore >= (input.accuracyTarget ?? 0.95),
      adaptiveFallback: input.level !== result.compressionLevel,
    },
  });

  await prisma.compressionMetric.create({
    data: {
      id: uuid(),
      compressionId: compression.id,
      tokensSaved: analytics.originalTokens - analytics.compressedTokens,
      wordsSaved: input.text.split(/\s+/).length - result.compressedText.split(/\s+/).length,
      charactersSaved: input.text.length - result.compressedText.length,
      moneySaved: analytics.costSavings,
      latencyReduced: analytics.latencyImprovement,
      semanticSimilarity: result.validation?.semanticSimilarity ?? analytics.semanticScore,
      reasoningRetention: result.validation?.reasoningRetention ?? 1,
      estimatedAccuracy: result.validation?.estimatedAccuracy ?? analytics.semanticScore,
      approved: result.validation?.approved ?? true,
      agentCount: result.agentResults.length,
    },
  });

  ActivityLogService.log({ userId: input.userId, action: 'compression.created', resource: 'compression', resourceId: compression.id });

  return {
    compressionId: compression.id,
    compressedText: result.compressedText,
    originalTokens: analytics.originalTokens,
    compressedTokens: analytics.compressedTokens,
    compressionRatio: analytics.compressionRatio,
    semanticScore: analytics.semanticScore,
    processingTimeMs: result.totalExecutionTimeMs,
  };
};

// OCR handler — lightweight, delegates to ocrService
const ocrHandler: JobHandler = async (rawInput, onProgress) => {
  const input = rawInput as any;
  await onProgress(10, 'Initializing OCR');

  // Dynamic import to avoid loading tesseract at module level
  const { ocrService } = await import('../services/ocr.service');
  const buffer = Buffer.from(input.imageBase64, 'base64');

  await onProgress(20, 'Processing image');
  const result = await ocrService.extractFromBuffer(buffer, input.language || 'eng');

  return {
    text: result.text,
    confidence: result.confidence,
    words: result.words,
    processingTimeMs: result.processingTimeMs,
    savings: result.savings,
  };
};

// OCR + Compress handler
const ocrCompressHandler: JobHandler = async (rawInput, onProgress) => {
  const input = rawInput as any;
  await onProgress(5, 'Initializing OCR');

  const { ocrService } = await import('../services/ocr.service');
  const buffer = Buffer.from(input.imageBase64, 'base64');

  await onProgress(15, 'Extracting text from image');
  const ocrResult = await ocrService.extractFromBuffer(buffer, input.language || 'eng');

  if (!ocrResult.text?.trim()) throw new Error('No text extracted from image');

  await onProgress(50, 'Running compression pipeline');
  const compression = await supervisor.orchestrate({
    text: ocrResult.text,
    userId: input.userId,
    compressionLevel: input.compressionLevel || 'medium',
    llmProvider: input.llmProvider || 'openai',
  });

  if (compression.status === 'failed') throw new Error(compression.error || 'Compression failed');

  return {
    ocr: { text: ocrResult.text, confidence: ocrResult.confidence, words: ocrResult.words, savings: ocrResult.savings },
    compression: {
      compressedText: compression.compressedText,
      originalTokens: compression.analytics?.originalTokens ?? 0,
      compressedTokens: compression.analytics?.compressedTokens ?? 0,
      compressionRatio: compression.analytics?.compressionRatio ?? 0,
      semanticScore: compression.analytics?.semanticScore ?? 0,
    },
  };
};

// ─── Init function ───────────────────────────────────────────────────────

export async function initQueue(): Promise<void> {
  JobQueue.register('compression', compressionHandler);
  JobQueue.register('ocr', ocrHandler);
  JobQueue.register('ocr_compress', ocrCompressHandler);
  await JobQueue.recoverStuckJobs();
  logger.info('[Queue] Initialized (compression, ocr, ocr_compress)');
}
