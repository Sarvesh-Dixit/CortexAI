import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { SupervisorAgent } from '../agents';
import { CompressionLevel } from '../agents/types';
import { estimateTokens, estimateCost } from '../utils/tokens';
import { computeFidelity } from '../utils/fidelity';
import { llmConnector } from '../services';
import { ApiKeyService } from '../services/api-key.service';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const playgroundRouter = Router();
const supervisor = new SupervisorAgent();

/**
 * GET /playground/models - list all providers with their available models
 */
playgroundRouter.get('/models', authenticate, (_req, res) => {
  const providers = llmConnector.getAllProviders().map((p) => ({
    id: p.id,
    name: p.name,
    defaultModel: p.model,
    models: p.models,
    contextWindow: p.maxTokens,
    costPer1kInput: p.costPer1kInput,
    costPer1kOutput: p.costPer1kOutput,
  }));

  res.json({ success: true, data: providers });
});

/**
 * POST /playground/benchmark - the flagship benchmark endpoint.
 *
 * Runs both the original and compressed prompts in parallel against the same
 * LLM and returns a rich telemetry payload:
 *   - Token counts for each request
 *   - Latency for each request
 *   - Cost for each request
 *   - Reasoning fidelity (semantic similarity between the two LLM outputs)
 *
 * If `compressedPrompt` is omitted, we run the full ContextIQ compression
 * pipeline on the original to produce one on the fly.
 */
playgroundRouter.post('/benchmark', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const {
      originalPrompt,
      compressedPrompt,
      provider = 'openai',
      model,
      level = 'medium',
      temperature = 0.7,
      maxTokens = 1024,
    } = req.body;

    if (!originalPrompt || typeof originalPrompt !== 'string') {
      throw new AppError('originalPrompt is required', 400);
    }

    const providerInfo = llmConnector.getProvider(provider);
    if (!providerInfo) throw new AppError(`Unknown provider: ${provider}`, 400);

    const targetModel = model || providerInfo.model;
    if (model && !providerInfo.models.includes(model)) {
      throw new AppError(`Model ${model} not available for ${provider}`, 400);
    }

    // Auto-compress if user didn't provide a compressed version
    let finalCompressed = compressedPrompt;
    let pipelineMeta = null;

    if (!finalCompressed || typeof finalCompressed !== 'string' || finalCompressed.trim().length === 0) {
      logger.info('[Benchmark] No compressed prompt provided, running pipeline');
      const pipeline = await supervisor.orchestrate({
        text: originalPrompt,
        userId: req.userId!,
        compressionLevel: level as CompressionLevel,
        llmProvider: provider,
      });

      if (pipeline.status === 'failed') {
        throw new AppError(`Auto-compression failed: ${pipeline.error}`, 500);
      }

      finalCompressed = pipeline.compressedText;
      pipelineMeta = {
        agentsExecuted: pipeline.agentResults.length,
        totalTimeMs: pipeline.totalExecutionTimeMs,
        semanticScore: pipeline.analytics?.semanticScore ?? 0,
        compressionRatio: pipeline.analytics?.compressionRatio ?? 0,
      };
    }

    // Resolve user's API key just-in-time (decrypts on demand, never logs it)
    const resolved = await ApiKeyService.resolve(req.userId!, provider);

    logger.info(`[Benchmark] Running parallel inference on ${provider}/${targetModel} (key=${resolved.source})`);

    // Run both prompts in parallel against the same LLM
    const benchmarkStart = Date.now();
    const [originalResult, compressedResult] = await Promise.allSettled([
      llmConnector.send({
        prompt: originalPrompt,
        provider,
        model: targetModel,
        temperature,
        maxTokens,
        apiKey: resolved.key || undefined,
      }),
      llmConnector.send({
        prompt: finalCompressed,
        provider,
        model: targetModel,
        temperature,
        maxTokens,
        apiKey: resolved.key || undefined,
      }),
    ]);
    const totalWallTimeMs = Date.now() - benchmarkStart;

    if (originalResult.status === 'rejected') {
      throw new AppError(`Original prompt failed: ${originalResult.reason.message}`, 500);
    }
    if (compressedResult.status === 'rejected') {
      throw new AppError(`Compressed prompt failed: ${compressedResult.reason.message}`, 500);
    }

    const originalRes = originalResult.value;
    const compressedRes = compressedResult.value;

    // Compute reasoning fidelity — how similar are the two LLM outputs?
    const fidelity = computeFidelity(originalRes.text, compressedRes.text);

    // Telemetry summary
    const tokensSaved = originalRes.inputTokens - compressedRes.inputTokens;
    const costSaved = originalRes.cost - compressedRes.cost;
    const latencyDelta = originalRes.latencyMs - compressedRes.latencyMs;
    const latencyImprovementPct = originalRes.latencyMs > 0
      ? (latencyDelta / originalRes.latencyMs) * 100
      : 0;
    const tokenReductionPct = originalRes.inputTokens > 0
      ? (tokensSaved / originalRes.inputTokens) * 100
      : 0;

    const responsePayload = {
      provider,
      model: targetModel,
      original: {
        prompt: originalPrompt,
        inputTokens: originalRes.inputTokens,
        outputTokens: originalRes.tokens,
        latencyMs: originalRes.latencyMs,
        cost: originalRes.cost,
        response: originalRes.text,
        simulated: originalRes.simulated,
      },
      compressed: {
        prompt: finalCompressed,
        inputTokens: compressedRes.inputTokens,
        outputTokens: compressedRes.tokens,
        latencyMs: compressedRes.latencyMs,
        cost: compressedRes.cost,
        response: compressedRes.text,
        simulated: compressedRes.simulated,
      },
      telemetry: {
        tokensSaved,
        tokenReductionPct: Math.round(tokenReductionPct * 100) / 100,
        latencyDelta,
        latencyImprovementPct: Math.round(latencyImprovementPct * 100) / 100,
        costSaved,
        costSavedMicroUsd: Math.round(costSaved * 1_000_000),
        fidelity: {
          score: Math.round(fidelity.score * 10000) / 10000,
          scorePct: Math.round(fidelity.score * 10000) / 100,
          cosineSimilarity: Math.round(fidelity.cosineSimilarity * 10000) / 10000,
          entityPreservation: Math.round(fidelity.entityPreservation * 10000) / 10000,
          lengthRatio: Math.round(fidelity.lengthRatio * 10000) / 10000,
          verdict: fidelity.verdict,
        },
        totalWallTimeMs,
        usedUserKey: originalRes.usedUserKey,
      },
      pipeline: pipelineMeta,
    };

    logger.info(
      `[Benchmark] Complete: tokens=${originalRes.inputTokens}→${compressedRes.inputTokens} ` +
      `(${tokenReductionPct.toFixed(1)}% saved), fidelity=${(fidelity.score * 100).toFixed(1)}%, ` +
      `latency ${originalRes.latencyMs}ms→${compressedRes.latencyMs}ms`
    );

    res.json({ success: true, data: responsePayload });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /playground/compress-and-compare - (kept for backwards compat) run compression pipeline
 * and return provider comparison across all supported LLMs.
 */
playgroundRouter.post('/compress-and-compare', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, level = 'medium', provider = 'openai' } = req.body;
    if (!text) throw new AppError('Text is required', 400);

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

    res.json({
      success: true,
      data: {
        original: {
          text, tokens: originalTokens,
          cost: estimateCost(originalTokens, provider),
          estimatedLatency: originalTokens * 0.05,
        },
        compressed: {
          text: result.compressedText, tokens: compressedTokens,
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
            name: r.agentName, status: r.status, timeMs: r.executionTimeMs,
          })),
          documentType: result.documentType,
          language: result.detectedLanguage,
          validation: result.validation,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /playground/token-count - fast token counting for the UI
 */
playgroundRouter.post('/token-count', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text } = req.body;
    if (!text) throw new AppError('Text is required', 400);

    const tokens = estimateTokens(text);
    res.json({
      success: true,
      data: {
        tokens, characters: text.length, words: text.split(/\s+/).length,
        costs: {
          openai: estimateCost(tokens, 'openai'),
          gemini: estimateCost(tokens, 'gemini'),
          claude: estimateCost(tokens, 'claude'),
          llama: estimateCost(tokens, 'llama'),
          deepseek: estimateCost(tokens, 'deepseek'),
          mistral: estimateCost(tokens, 'mistral'),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

function generateProviderComparison(originalTokens: number, compressedTokens: number) {
  const providers = ['openai', 'gemini', 'claude', 'llama', 'deepseek', 'mistral'];
  return providers.map((p) => {
    const original = estimateCost(originalTokens, p);
    const compressed = estimateCost(compressedTokens, p);
    return {
      provider: p,
      originalCost: original,
      compressedCost: compressed,
      savings: original - compressed,
      savingsPercentage: original > 0 ? ((original - compressed) / original) * 100 : 0,
    };
  });
}
