import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';

export const analyticsRouter = Router();

/**
 * GET /analytics/overview - main overview stats
 */
analyticsRouter.get('/overview', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const compressions = await prisma.compression.findMany({
      where: { userId: req.userId },
      select: {
        originalTokens: true,
        compressedTokens: true,
        compressionRatio: true,
        semanticScore: true,
        costSavings: true,
        latencyImprovement: true,
      },
    });

    const totalPrompts = compressions.length;
    const totalTokensSaved = compressions.reduce((s, c) => s + (c.originalTokens - c.compressedTokens), 0);
    const avgCompression = totalPrompts > 0
      ? compressions.reduce((s, c) => s + c.compressionRatio, 0) / totalPrompts : 0;
    const avgAccuracy = totalPrompts > 0
      ? compressions.reduce((s, c) => s + c.semanticScore, 0) / totalPrompts : 0;
    const totalMoneySaved = compressions.reduce((s, c) => s + c.costSavings, 0);
    const avgLatencyReduction = totalPrompts > 0
      ? compressions.reduce((s, c) => s + (c.latencyImprovement || 0), 0) / totalPrompts : 0;

    res.json({
      success: true,
      data: {
        totalPrompts,
        totalTokensSaved,
        avgCompression: Math.round(avgCompression * 100) / 100,
        avgAccuracy: Math.round(avgAccuracy * 100) / 100,
        totalMoneySaved: Math.round(totalMoneySaved * 100) / 100,
        avgLatencyReduction: Math.round(avgLatencyReduction * 100) / 100,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/dashboard - complete dashboard data in one call
 */
analyticsRouter.get('/dashboard', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      allCompressions,
      recentCompressions,
      documentCount,
      apiKeyCount,
      recentDocs,
    ] = await Promise.all([
      prisma.compression.findMany({
        where: { userId },
        select: {
          originalTokens: true, compressedTokens: true,
          compressionRatio: true, semanticScore: true,
          costSavings: true, llmProvider: true, documentType: true,
        },
      }),
      prisma.compression.findMany({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true, documentType: true, compressionRatio: true,
          costSavings: true, createdAt: true, originalText: true,
        },
      }),
      prisma.document.count({ where: { userId } }),
      prisma.apiKey.count({ where: { userId, isActive: true } }),
      prisma.document.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, originalName: true, documentType: true, size: true, createdAt: true },
      }),
    ]);

    const totalPrompts = allCompressions.length;
    const totalTokensSaved = allCompressions.reduce((s, c) => s + (c.originalTokens - c.compressedTokens), 0);
    const totalMoneySaved = allCompressions.reduce((s, c) => s + c.costSavings, 0);
    const avgCompression = totalPrompts > 0
      ? allCompressions.reduce((s, c) => s + c.compressionRatio, 0) / totalPrompts : 0;
    const avgAccuracy = totalPrompts > 0
      ? allCompressions.reduce((s, c) => s + c.semanticScore, 0) / totalPrompts : 0;

    // Most used LLM
    const llmCounts: Record<string, number> = {};
    for (const c of allCompressions) {
      const p = c.llmProvider || 'openai';
      llmCounts[p] = (llmCounts[p] || 0) + 1;
    }
    const mostUsedLlm = Object.entries(llmCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    // Most used document type
    const typeCounts: Record<string, number> = {};
    for (const c of allCompressions) {
      typeCounts[c.documentType] = (typeCounts[c.documentType] || 0) + 1;
    }
    const mostUsedDocType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    res.json({
      success: true,
      data: {
        overview: {
          totalPrompts, totalTokensSaved, totalMoneySaved,
          avgCompression, avgAccuracy,
          apiCalls: totalPrompts,
          documentCount, apiKeyCount,
          mostUsedLlm, mostUsedDocType,
        },
        recentActivity: recentCompressions.map((c) => ({
          id: c.id,
          documentType: c.documentType,
          compressionRatio: c.compressionRatio,
          costSavings: c.costSavings,
          preview: c.originalText.slice(0, 100),
          createdAt: c.createdAt,
        })),
        recentDocuments: recentDocs,
        weekly: { since: sevenDaysAgo, prompts: allCompressions.length },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/compression - compression-specific metrics
 */
analyticsRouter.get('/compression', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const compressions = await prisma.compression.findMany({
      where: { userId: req.userId },
      select: {
        compressionRatio: true, semanticScore: true,
        compressionLevel: true, documentType: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const byLevel: Record<string, { count: number; avgRatio: number; avgAccuracy: number }> = {};
    for (const c of compressions) {
      const key = c.compressionLevel;
      if (!byLevel[key]) byLevel[key] = { count: 0, avgRatio: 0, avgAccuracy: 0 };
      byLevel[key].count++;
      byLevel[key].avgRatio += c.compressionRatio;
      byLevel[key].avgAccuracy += c.semanticScore;
    }
    for (const key of Object.keys(byLevel)) {
      byLevel[key].avgRatio /= byLevel[key].count;
      byLevel[key].avgAccuracy /= byLevel[key].count;
    }

    res.json({
      success: true,
      data: {
        totalCompressions: compressions.length,
        byLevel,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/history - historical trend data
 */
analyticsRouter.get('/history', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const compressions = await prisma.compression.findMany({
      where: { userId: req.userId, createdAt: { gte: since } },
      select: { createdAt: true, compressionRatio: true, semanticScore: true, costSavings: true },
      orderBy: { createdAt: 'asc' },
    });

    res.json({ success: true, data: compressions });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/trends - grouped by day
 */
analyticsRouter.get('/trends', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.userId!;
    const { period = '30' } = req.query;
    const days = parseInt(period as string);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const compressions = await prisma.compression.findMany({
      where: { userId, createdAt: { gte: since } },
      select: {
        compressionRatio: true, semanticScore: true, costSavings: true,
        originalTokens: true, compressedTokens: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const dailyData: Record<string, {
      date: string; compressions: number; avgRatio: number;
      avgAccuracy: number; tokensSaved: number; costSaved: number;
    }> = {};

    for (const c of compressions) {
      const date = c.createdAt.toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = {
          date, compressions: 0, avgRatio: 0, avgAccuracy: 0,
          tokensSaved: 0, costSaved: 0,
        };
      }
      dailyData[date].compressions++;
      dailyData[date].avgRatio += c.compressionRatio;
      dailyData[date].avgAccuracy += c.semanticScore;
      dailyData[date].tokensSaved += c.originalTokens - c.compressedTokens;
      dailyData[date].costSaved += c.costSavings;
    }

    const trends = Object.values(dailyData).map((d) => ({
      ...d,
      avgRatio: d.compressions > 0 ? Math.round((d.avgRatio / d.compressions) * 100) : 0,
      avgAccuracy: d.compressions > 0 ? Math.round((d.avgAccuracy / d.compressions) * 100) : 0,
    }));

    res.json({ success: true, data: trends });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/token-savings - dedicated token savings breakdown
 */
analyticsRouter.get('/token-savings', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const compressions = await prisma.compression.findMany({
      where: { userId: req.userId },
      select: { originalTokens: true, compressedTokens: true, compressionLevel: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const totalOriginal = compressions.reduce((s, c) => s + c.originalTokens, 0);
    const totalCompressed = compressions.reduce((s, c) => s + c.compressedTokens, 0);
    const totalSaved = totalOriginal - totalCompressed;

    const byLevel: Record<string, { saved: number; count: number }> = {};
    for (const c of compressions) {
      const key = c.compressionLevel;
      if (!byLevel[key]) byLevel[key] = { saved: 0, count: 0 };
      byLevel[key].saved += c.originalTokens - c.compressedTokens;
      byLevel[key].count++;
    }

    res.json({
      success: true,
      data: {
        totalOriginal, totalCompressed, totalSaved,
        savingsRatio: totalOriginal > 0 ? totalSaved / totalOriginal : 0,
        byLevel,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/cost - cost analytics by provider
 */
analyticsRouter.get('/cost', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const compressions = await prisma.compression.findMany({
      where: { userId: req.userId },
      select: {
        originalCost: true, compressedCost: true, costSavings: true,
        llmProvider: true, createdAt: true,
      },
    });

    const totalOriginalCost = compressions.reduce((s, c) => s + c.originalCost, 0);
    const totalCompressedCost = compressions.reduce((s, c) => s + c.compressedCost, 0);
    const totalSavings = compressions.reduce((s, c) => s + c.costSavings, 0);

    const byProvider: Record<string, { originalCost: number; compressedCost: number; savings: number; count: number }> = {};
    for (const c of compressions) {
      const p = c.llmProvider || 'openai';
      if (!byProvider[p]) byProvider[p] = { originalCost: 0, compressedCost: 0, savings: 0, count: 0 };
      byProvider[p].originalCost += c.originalCost;
      byProvider[p].compressedCost += c.compressedCost;
      byProvider[p].savings += c.costSavings;
      byProvider[p].count++;
    }

    res.json({
      success: true,
      data: {
        totalOriginalCost, totalCompressedCost, totalSavings,
        savingsPercentage: totalOriginalCost > 0 ? (totalSavings / totalOriginalCost) * 100 : 0,
        byProvider,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/latency - latency improvements
 */
analyticsRouter.get('/latency', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const compressions = await prisma.compression.findMany({
      where: { userId: req.userId },
      select: {
        latencyOriginalMs: true, latencyCompressedMs: true,
        latencyImprovement: true, processingTimeMs: true, createdAt: true,
      },
    });

    const totalOriginalLatency = compressions.reduce((s, c) => s + (c.latencyOriginalMs || 0), 0);
    const totalCompressedLatency = compressions.reduce((s, c) => s + (c.latencyCompressedMs || 0), 0);
    const totalTimeSaved = totalOriginalLatency - totalCompressedLatency;
    const avgProcessingTime = compressions.length > 0
      ? compressions.reduce((s, c) => s + (c.processingTimeMs || 0), 0) / compressions.length : 0;

    res.json({
      success: true,
      data: {
        totalOriginalLatency, totalCompressedLatency, totalTimeSaved,
        avgProcessingTime,
        avgLatencyImprovement: compressions.length > 0
          ? compressions.reduce((s, c) => s + (c.latencyImprovement || 0), 0) / compressions.length
          : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/document-types - distribution of document types
 */
analyticsRouter.get('/document-types', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const compressions = await prisma.compression.findMany({
      where: { userId: req.userId },
      select: { documentType: true },
    });

    const typeCounts: Record<string, number> = {};
    for (const c of compressions) {
      typeCounts[c.documentType] = (typeCounts[c.documentType] || 0) + 1;
    }

    const data = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count, percentage: 0 }))
      .sort((a, b) => b.count - a.count);

    const total = data.reduce((sum, d) => sum + d.count, 0);
    for (const item of data) {
      item.percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
    }

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /analytics/usage - daily usage for last 7 days
 */
analyticsRouter.get('/usage', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const daily = await prisma.compression.findMany({
      where: { userId: req.userId, createdAt: { gte: sevenDaysAgo } },
      select: { createdAt: true, costSavings: true, originalTokens: true, compressedTokens: true },
      orderBy: { createdAt: 'asc' },
    });

    const bucket: Record<string, { count: number; savings: number; tokens: number }> = {};
    for (let i = 0; i < 7; i++) {
      const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      bucket[date] = { count: 0, savings: 0, tokens: 0 };
    }

    for (const c of daily) {
      const date = c.createdAt.toISOString().split('T')[0];
      if (bucket[date]) {
        bucket[date].count++;
        bucket[date].savings += c.costSavings;
        bucket[date].tokens += c.originalTokens - c.compressedTokens;
      }
    }

    res.json({
      success: true,
      data: {
        daily: Object.entries(bucket).map(([date, stats]) => ({ date, ...stats })).reverse(),
      },
    });
  } catch (error) {
    next(error);
  }
});
