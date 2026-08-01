/**
 * LLM Provider Routes.
 * 
 * GET  /llm/providers   - List all available LLM providers with metadata
 * POST /llm/test        - Test connection to an LLM provider (with user's API key)
 * POST /llm/compress    - Compress a prompt and send it to the target LLM
 * POST /llm/chat        - Direct chat with an LLM provider (proxied through their API key)
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { llmConnector } from '../services';
import { SupervisorAgent } from '../agents';
import { CompressionLevel } from '../agents/types';
import { estimateTokens, estimateCost } from '../utils/tokens';
import { ActivityLogService } from '../services/activity-log.service';
import { AppError } from '../middleware/errorHandler';
import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

export const llmRouter = Router();
const supervisor = new SupervisorAgent();

/**
 * GET /llm/providers - list all providers with metadata
 */
llmRouter.get('/providers', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const providers = llmConnector.getAllProviders();
    res.json({
      success: true,
      data: providers.map((p) => ({
        id: p.name.toLowerCase().replace(/\s+.*$/, ''),
        name: p.name,
        model: p.model,
        contextWindow: p.maxTokens,
        costPer1kInput: p.costPer1kInput,
        costPer1kOutput: p.costPer1kOutput,
        estimatedLatencyPerToken: p.estimatedLatencyPerToken,
      })),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /llm/test - actually pings the LLM provider using the user's key
 * (or the system fallback) and reports whether it succeeded.
 */
llmRouter.post('/test', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.body;
    if (!provider) throw new AppError('Provider is required', 400);

    const providerInfo = llmConnector.getProvider(provider);
    if (!providerInfo) throw new AppError('Unknown provider', 400);

    const userKey = await prisma.apiKey.findFirst({
      where: { userId: req.userId, provider, isActive: true },
    });

    let result: { ok: boolean; error?: string; latency: number; usedUserKey: boolean; simulated: boolean; sample?: string };
    const testStart = Date.now();
    try {
      const testResult = await llmConnector.send({
        prompt: 'Say "OK" in one word.',
        provider,
        maxTokens: 10,
        apiKey: userKey?.key,
      });
      result = {
        ok: true,
        latency: Date.now() - testStart,
        usedUserKey: testResult.usedUserKey,
        simulated: testResult.simulated,
        sample: testResult.text.slice(0, 100),
      };
    } catch (err) {
      result = {
        ok: false,
        latency: Date.now() - testStart,
        usedUserKey: !!userKey,
        simulated: false,
        error: (err as Error).message,
      };
    }

    await ActivityLogService.log({
      userId: req.userId!,
      action: 'llm.tested',
      resource: 'llm_provider',
      resourceId: provider,
      metadata: { ok: result.ok, usedUserKey: result.usedUserKey, latency: result.latency },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: result.ok,
      data: {
        provider,
        model: providerInfo.model,
        reachable: result.ok,
        latencyMs: result.latency,
        usedUserKey: result.usedUserKey,
        simulated: result.simulated,
        sampleResponse: result.sample,
        error: result.error,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /llm/compress - compress a prompt and send it to a target LLM.
 * Returns both the compressed prompt and the LLM response.
 */
llmRouter.post('/compress', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, level = 'medium', provider = 'openai' } = req.body;

    if (!text) throw new AppError('Text is required', 400);

    const providerInfo = llmConnector.getProvider(provider);
    if (!providerInfo) throw new AppError('Unknown provider', 400);

    logger.info(`[LLM] Compress-and-send: user=${req.userId} provider=${provider} level=${level}`);

    // Run full multi-agent pipeline
    const pipelineResult = await supervisor.orchestrate({
      text,
      userId: req.userId!,
      compressionLevel: level as CompressionLevel,
      llmProvider: provider,
    });

    if (pipelineResult.status === 'failed') {
      throw new AppError(`Pipeline failed: ${pipelineResult.error}`, 500);
    }

    // Get user's API key for the provider
    const userKey = await prisma.apiKey.findFirst({
      where: { userId: req.userId, provider, isActive: true },
    });

    // Send compressed prompt to LLM
    const llmResponse = await llmConnector.send({
      prompt: pipelineResult.compressedText,
      provider,
      apiKey: userKey?.key,
    });

    res.json({
      success: true,
      data: {
        compression: {
          originalTokens: pipelineResult.analytics?.originalTokens ?? 0,
          compressedTokens: pipelineResult.analytics?.compressedTokens ?? 0,
          compressionRatio: pipelineResult.analytics?.compressionRatio ?? 0,
          semanticScore: pipelineResult.analytics?.semanticScore ?? 0,
          compressedText: pipelineResult.compressedText,
        },
        llmResponse: {
          text: llmResponse.text,
          tokens: llmResponse.tokens,
          model: llmResponse.model,
          latencyMs: llmResponse.latencyMs,
          cost: llmResponse.cost,
        },
        savings: {
          tokensSaved: (pipelineResult.analytics?.originalTokens ?? 0) - (pipelineResult.analytics?.compressedTokens ?? 0),
          costSaved: pipelineResult.analytics?.costSavings ?? 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /llm/chat - direct chat with an LLM provider (no compression).
 */
llmRouter.post('/chat', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { prompt, provider = 'openai', temperature = 0.7, maxTokens } = req.body;

    if (!prompt) throw new AppError('Prompt is required', 400);

    const providerInfo = llmConnector.getProvider(provider);
    if (!providerInfo) throw new AppError('Unknown provider', 400);

    const userKey = await prisma.apiKey.findFirst({
      where: { userId: req.userId, provider, isActive: true },
    });

    const response = await llmConnector.send({
      prompt,
      provider,
      temperature,
      maxTokens,
      apiKey: userKey?.key,
    });

    const inputTokens = estimateTokens(prompt);
    const inputCost = estimateCost(inputTokens, provider);

    res.json({
      success: true,
      data: {
        provider,
        model: response.model,
        response: response.text,
        inputTokens,
        outputTokens: response.tokens,
        inputCost,
        outputCost: response.cost,
        totalCost: inputCost + response.cost,
        latencyMs: response.latencyMs,
        usedUserKey: response.usedUserKey,
        simulated: response.simulated,
      },
    });
  } catch (error) {
    next(error);
  }
});
