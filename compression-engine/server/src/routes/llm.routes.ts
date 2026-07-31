/**
 * LLM Provider Routes.
 *
 * GET  /llm/providers   - List all available LLM providers with metadata
 * POST /llm/test        - Test connection to an LLM provider (uses stored key)
 * POST /llm/compress    - Compress a prompt and send it to the target LLM
 * POST /llm/chat        - Direct chat with an LLM provider
 *
 * All key resolution goes through ApiKeyService which decrypts just-in-time
 * and enforces per-user ownership.
 */

import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { llmConnector } from '../services';
import { ApiKeyService } from '../services/api-key.service';
import { SupervisorAgent } from '../agents';
import { CompressionLevel } from '../agents/types';
import { estimateTokens, estimateCost } from '../utils/tokens';
import { ActivityLogService } from '../services/activity-log.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

export const llmRouter = Router();
const supervisor = new SupervisorAgent();

llmRouter.get('/providers', authenticate, async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const providers = llmConnector.getAllProviders();
    res.json({
      success: true,
      data: providers.map((p) => ({
        id: p.id,
        name: p.name,
        model: p.model,
        models: p.models,
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

llmRouter.post('/test', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { provider } = req.body;
    if (!provider) throw new AppError('Provider is required', 400);

    const providerInfo = llmConnector.getProvider(provider);
    if (!providerInfo) throw new AppError('Unknown provider', 400);

    // Resolve the user's key (decrypts just-in-time)
    const resolved = await ApiKeyService.resolve(req.userId!, provider);

    let result: {
      ok: boolean; error?: string; latency: number;
      usedUserKey: boolean; simulated: boolean; sample?: string;
    };
    const testStart = Date.now();
    try {
      const testResult = await llmConnector.send({
        prompt: 'Say "OK" in one word.',
        provider,
        maxTokens: 10,
        apiKey: resolved.key || undefined,
      });
      result = {
        ok: true,
        latency: Date.now() - testStart,
        usedUserKey: resolved.source === 'user',
        simulated: testResult.simulated,
        sample: testResult.text.slice(0, 100),
      };
    } catch (err) {
      result = {
        ok: false,
        latency: Date.now() - testStart,
        usedUserKey: resolved.source === 'user',
        simulated: false,
        error: (err as Error).message,
      };
    }

    await ActivityLogService.log({
      userId: req.userId!,
      action: 'llm.tested',
      resource: 'llm_provider',
      resourceId: provider,
      metadata: { ok: result.ok, keySource: resolved.source, latency: result.latency },
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
        keySource: resolved.source,
        simulated: result.simulated,
        sampleResponse: result.sample,
        error: result.error,
      },
    });
  } catch (error) {
    next(error);
  }
});

llmRouter.post('/compress', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { text, level = 'medium', provider = 'openai', model } = req.body;
    if (!text) throw new AppError('Text is required', 400);

    const providerInfo = llmConnector.getProvider(provider);
    if (!providerInfo) throw new AppError('Unknown provider', 400);

    logger.info(`[LLM] Compress-and-send: user=${req.userId} provider=${provider} level=${level}`);

    const pipelineResult = await supervisor.orchestrate({
      text,
      userId: req.userId!,
      compressionLevel: level as CompressionLevel,
      llmProvider: provider,
    });

    if (pipelineResult.status === 'failed') {
      throw new AppError(`Pipeline failed: ${pipelineResult.error}`, 500);
    }

    const resolved = await ApiKeyService.resolve(req.userId!, provider);

    const llmResponse = await llmConnector.send({
      prompt: pipelineResult.compressedText,
      provider,
      model,
      apiKey: resolved.key || undefined,
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
          keySource: resolved.source,
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

llmRouter.post('/chat', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { prompt, provider = 'openai', model, temperature = 0.7, maxTokens } = req.body;
    if (!prompt) throw new AppError('Prompt is required', 400);

    const providerInfo = llmConnector.getProvider(provider);
    if (!providerInfo) throw new AppError('Unknown provider', 400);

    const resolved = await ApiKeyService.resolve(req.userId!, provider);

    const response = await llmConnector.send({
      prompt,
      provider,
      model,
      temperature,
      maxTokens,
      apiKey: resolved.key || undefined,
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
        usedUserKey: resolved.source === 'user',
        keySource: resolved.source,
        simulated: response.simulated,
      },
    });
  } catch (error) {
    next(error);
  }
});
