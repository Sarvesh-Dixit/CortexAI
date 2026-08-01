import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SupervisorAgent } from '../agents';
import { CompressionLevel } from '../agents/types';
import { estimateTokens, estimateCost, detectDocumentType } from '../utils/tokens';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { ActivityLogService } from '../services/activity-log.service';
import { v4 as uuid } from 'uuid';

export const compressionRouter = Router();
const supervisor = new SupervisorAgent();

/**
 * Core compression handler used by both /compress and /start.
 */
async function runCompression(req: AuthRequest, res: Response) {
  const { text, level = 'medium', documentType, llmProvider = 'openai', documentId } = req.body;

  if (!text || text.trim().length === 0) {
    throw new AppError('Text is required for compression', 400);
  }

  logger.info(`[Compression] Starting pipeline: user=${req.userId} level=${level}`);

  const workflowResult = await supervisor.orchestrate({
    text,
    userId: req.userId!,
    compressionLevel: level as CompressionLevel,
    llmProvider,
    filename: req.body.filename,
  });

  if (workflowResult.status === 'failed') {
    throw new AppError(`Compression pipeline failed: ${workflowResult.error}`, 500);
  }

  const analytics = workflowResult.analytics!;

  const compression = await prisma.compression.create({
    data: {
      id: workflowResult.id,
      userId: req.userId!,
      documentId: documentId || null,
      originalText: text,
      compressedText: workflowResult.compressedText,
      originalTokens: analytics.originalTokens,
      compressedTokens: analytics.compressedTokens,
      compressionRatio: analytics.compressionRatio,
      semanticScore: analytics.semanticScore,
      compressionLevel: level,
      llmProvider,
      documentType: documentType || workflowResult.documentType,
      language: workflowResult.detectedLanguage,
      originalCost: analytics.originalCost,
      compressedCost: analytics.compressedCost,
      costSavings: analytics.costSavings,
      latencyOriginal: analytics.originalTokens * 0.05,
      latencyCompressed: analytics.compressedTokens * 0.05,
      latencyImprovement: analytics.latencyImprovement,
      processingTime: workflowResult.totalExecutionTimeMs,
    },
  });

  // Persist detailed metrics
  await prisma.compressionMetric.create({
    data: {
      id: uuid(),
      compressionId: compression.id,
      tokensSaved: analytics.originalTokens - analytics.compressedTokens,
      wordsSaved: text.split(/\s+/).length - workflowResult.compressedText.split(/\s+/).length,
      charactersSaved: text.length - workflowResult.compressedText.length,
      moneySaved: analytics.costSavings,
      latencyReduced: analytics.latencyImprovement,
      semanticSimilarity: workflowResult.validation?.semanticSimilarity ?? analytics.semanticScore,
      reasoningRetention: workflowResult.validation?.reasoningRetention ?? 1,
      estimatedAccuracy: workflowResult.validation?.estimatedAccuracy ?? analytics.semanticScore,
      approved: workflowResult.validation?.approved ?? true,
      agentCount: workflowResult.agentResults.length,
    },
  });

  ActivityLogService.log({
    userId: req.userId!,
    action: 'compression.created',
    resource: 'compression',
    resourceId: compression.id,
    metadata: {
      level, provider: llmProvider,
      ratio: analytics.compressionRatio,
      tokensSaved: analytics.originalTokens - analytics.compressedTokens,
    },
    ipAddress: req.ip,
  });

  logger.info(`[Compression] Complete: ratio=${(analytics.compressionRatio * 100).toFixed(1)}% time=${workflowResult.totalExecutionTimeMs}ms`);

  res.json({
    success: true,
    data: {
      id: compression.id,
      originalText: text,
      compressedText: workflowResult.compressedText,
      originalTokens: analytics.originalTokens,
      compressedTokens: analytics.compressedTokens,
      compressionRatio: analytics.compressionRatio,
      semanticScore: analytics.semanticScore,
      documentType: workflowResult.documentType,
      language: workflowResult.detectedLanguage,
      originalCost: analytics.originalCost,
      compressedCost: analytics.compressedCost,
      costSavings: analytics.costSavings,
      latency: workflowResult.totalExecutionTimeMs,
      removedSections: [],
      modifiedSections: [],
      pipeline: {
        totalTimeMs: workflowResult.totalExecutionTimeMs,
        agentsExecuted: workflowResult.agentResults.length,
        agentResults: workflowResult.agentResults.map((r) => ({
          agent: r.agentName,
          status: r.status,
          timeMs: r.executionTimeMs,
        })),
        validation: workflowResult.validation,
      },
    },
  });
}

/**
 * POST /compression/compress - primary endpoint
 */
compressionRouter.post('/compress', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await runCompression(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /compression/start - alias for /compress (spec-compliant naming)
 */
compressionRouter.post('/start', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await runCompression(req, res);
  } catch (error) {
    next(error);
  }
});

/**
 * POST /compression/analyze - analyze without compressing
 */
compressionRouter.post('/analyze', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, filename } = req.body;
    if (!text) throw new AppError('Text is required', 400);

    const documentType = detectDocumentType(text, filename);
    const tokens = estimateTokens(text, documentType);
    const words = text.split(/\s+/).filter((w: string) => w.length > 0).length;
    const characters = text.length;
    const sentences = text.split(/[.!?]+/).filter((s: string) => s.trim().length > 0).length;
    const avgWordsPerSentence = sentences > 0 ? words / sentences : 0;
    const readabilityScore = Math.max(0, Math.min(100, 206.835 - (1.015 * avgWordsPerSentence) - (84.6 * 1.5)));

    const costs: Record<string, number> = {
      openai: estimateCost(tokens, 'openai'),
      gemini: estimateCost(tokens, 'gemini'),
      claude: estimateCost(tokens, 'claude'),
      llama: estimateCost(tokens, 'llama'),
      deepseek: estimateCost(tokens, 'deepseek'),
      mistral: estimateCost(tokens, 'mistral'),
    };

    let recommendation: string;
    if (tokens > 10000) recommendation = 'extreme';
    else if (tokens > 5000) recommendation = 'high';
    else if (tokens > 2000) recommendation = 'medium';
    else recommendation = 'low';

    res.json({
      success: true,
      data: {
        words, characters, tokens, sentences,
        documentType,
        readabilityScore: Math.round(readabilityScore),
        costs,
        recommendation,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /compression/compare - compare compression across multiple levels
 */
compressionRouter.post('/compare', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, llmProvider = 'openai' } = req.body;
    if (!text) throw new AppError('Text is required', 400);

    const levels: CompressionLevel[] = ['low', 'medium', 'high', 'extreme'];

    const results = await Promise.all(
      levels.map(async (level) => {
        const result = await supervisor.orchestrate({
          text,
          userId: req.userId!,
          compressionLevel: level,
          llmProvider,
        });

        return {
          level,
          status: result.status,
          compressedText: result.compressedText,
          originalTokens: result.analytics?.originalTokens ?? 0,
          compressedTokens: result.analytics?.compressedTokens ?? 0,
          compressionRatio: result.analytics?.compressionRatio ?? 0,
          semanticScore: result.analytics?.semanticScore ?? 0,
          costSavings: result.analytics?.costSavings ?? 0,
          processingTime: result.totalExecutionTimeMs,
          approved: result.validation?.approved ?? true,
        };
      })
    );

    res.json({
      success: true,
      data: {
        original: {
          text,
          tokens: results[0].originalTokens,
        },
        comparisons: results,
        recommendation: recommendBestLevel(results),
      },
    });
  } catch (error) {
    next(error);
  }
});

function recommendBestLevel(results: Array<{
  level: string; compressionRatio: number; semanticScore: number; approved: boolean;
}>) {
  // Pick the highest compression that's still approved with >90% semantic score
  const approved = results.filter((r) => r.approved && r.semanticScore >= 0.9);
  if (approved.length === 0) return 'low';
  return approved.reduce((best, r) => (r.compressionRatio > best.compressionRatio ? r : best)).level;
}

/**
 * GET /compression/history - paginated compression history
 */
compressionRouter.get('/history', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = '1', limit = '20', search, documentType, sortBy = 'createdAt', order = 'desc' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    const where: Record<string, unknown> = { userId: req.userId };

    if (search) {
      where.OR = [
        { originalText: { contains: search as string } },
        { compressedText: { contains: search as string } },
      ];
    }
    if (documentType) {
      where.documentType = documentType;
    }

    const [compressions, total] = await Promise.all([
      prisma.compression.findMany({
        where,
        orderBy: { [sortBy as string]: order },
        skip,
        take: limitNum,
        select: {
          id: true,
          originalTokens: true,
          compressedTokens: true,
          compressionRatio: true,
          semanticScore: true,
          compressionLevel: true,
          llmProvider: true,
          documentType: true,
          costSavings: true,
          status: true,
          createdAt: true,
          originalText: true,
          compressedText: true,
        },
      }),
      prisma.compression.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        compressions: compressions.map((c) => ({
          ...c,
          originalText: c.originalText.slice(0, 200),
          compressedText: c.compressedText.slice(0, 200),
        })),
        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /compression/:id - get a single compression with metrics
 */
compressionRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const compression = await prisma.compression.findFirst({
      where: { id, userId: req.userId },
      include: { metrics: true },
    });

    if (!compression) throw new AppError('Compression not found', 404);

    res.json({ success: true, data: compression });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /compression/:id - remove a compression
 */
compressionRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const existing = await prisma.compression.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existing) throw new AppError('Compression not found', 404);

    await prisma.compression.delete({ where: { id } });

    ActivityLogService.log({
      userId: req.userId!,
      action: 'compression.deleted',
      resource: 'compression',
      resourceId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Compression deleted' });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /compression/history/:id - get a history record (kept for backwards compat)
 */
compressionRouter.get('/history/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const compression = await prisma.compression.findFirst({
      where: { id, userId: req.userId },
    });
    if (!compression) throw new AppError('Compression not found', 404);
    res.json({ success: true, data: compression });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /compression/history/:id - kept for backwards compat
 */
compressionRouter.delete('/history/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.compression.deleteMany({
      where: { id, userId: req.userId },
    });
    res.json({ success: true, message: 'Compression deleted' });
  } catch (error) {
    next(error);
  }
});
