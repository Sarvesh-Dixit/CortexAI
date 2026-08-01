import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SupervisorAgent } from '../agents';
import { CompressionLevel } from '../agents/types';
import { estimateTokens, estimateCost } from '../utils/tokens';
import { AppError } from '../middleware/errorHandler';

export const playgroundRouter = Router();
const supervisor = new SupervisorAgent();

playgroundRouter.post('/compress-and-compare', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, level = 'medium', provider = 'openai' } = req.body;

    if (!text) throw new AppError('Text is required', 400);

    // Execute multi-agent pipeline
    const result = await supervisor.orchestrate({
      text,
      userId: req.userId!,
      compressionLevel: level as CompressionLevel,
      llmProvider: provider,
    });

    if (result.status === 'failed') {
      throw new AppError(`Pipeline failed: ${result.error}`, 500);
    }

    const originalTokens = result.analytics!.originalTokens;
    const compressedTokens = result.analytics!.compressedTokens;

    const comparison = {
      original: {
        text,
        tokens: originalTokens,
        cost: estimateCost(originalTokens, provider),
        estimatedLatency: originalTokens * 0.05,
      },
      compressed: {
        text: result.compressedText,
        tokens: compressedTokens,
        cost: estimateCost(compressedTokens, provider),
        estimatedLatency: compressedTokens * 0.05,
      },
      metrics: {
        compressionRatio: result.analytics!.compressionRatio,
        semanticScore: result.analytics!.semanticScore,
        tokensSaved: originalTokens - compressedTokens,
        costSaved: result.analytics!.costSavings,
        processingTime: result.totalExecutionTimeMs,
      },
      providers: generateProviderComparison(originalTokens, compressedTokens),
      pipeline: {
        agentsExecuted: result.agentResults.length,
        agents: result.agentResults.map((r: any) => ({
          name: r.agentName,
          status: r.status,
          timeMs: r.executionTimeMs,
        })),
        documentType: result.documentType,
        language: result.detectedLanguage,
        validation: result.validation,
      },
    };

    res.json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
});

playgroundRouter.post('/token-count', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;
    if (!text) throw new AppError('Text is required', 400);

    const tokens = estimateTokens(text);
    const costs = {
      openai: estimateCost(tokens, 'openai'),
      gemini: estimateCost(tokens, 'gemini'),
      claude: estimateCost(tokens, 'claude'),
      llama: estimateCost(tokens, 'llama'),
      deepseek: estimateCost(tokens, 'deepseek'),
      mistral: estimateCost(tokens, 'mistral'),
    };

    res.json({
      success: true,
      data: { tokens, characters: text.length, words: text.split(/\s+/).length, costs },
    });
  } catch (error) {
    next(error);
  }
});

function generateProviderComparison(originalTokens: number, compressedTokens: number) {
  const providers = ['openai', 'gemini', 'claude', 'llama', 'deepseek', 'mistral'];

  return providers.map(provider => ({
    provider,
    originalCost: estimateCost(originalTokens, provider),
    compressedCost: estimateCost(compressedTokens, provider),
    savings: estimateCost(originalTokens, provider) - estimateCost(compressedTokens, provider),
    savingsPercentage: ((estimateCost(originalTokens, provider) - estimateCost(compressedTokens, provider)) / estimateCost(originalTokens, provider)) * 100,
  }));
}
