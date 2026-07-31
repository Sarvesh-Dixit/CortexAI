import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { encrypt, sha256, keyPrefix } from '../utils/crypto';
import { ActivityLogService } from '../services/activity-log.service';
import { v4 as uuid } from 'uuid';

export const settingsRouter = Router();

const VALID_PROVIDERS = [
  'openai', 'gemini', 'claude', 'llama', 'deepseek', 'mistral', 'ollama', 'qwen', 'gemma',
];

settingsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        theme: true, language: true, preferredLlm: true, defaultCompression: true,
      },
    });

    // Return API keys WITHOUT the ciphertext — only masked prefix
    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        provider: true,
        label: true,
        keyPrefix: true,
        isActive: true,
        lastUsedAt: true,
        usageCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ success: true, data: { ...user, apiKeys } });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { theme, language, preferredLlm, defaultCompression } = req.body;

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        ...(theme && { theme }),
        ...(language && { language }),
        ...(preferredLlm && { preferredLlm }),
        ...(defaultCompression && { defaultCompression }),
      },
      select: {
        theme: true, language: true, preferredLlm: true, defaultCompression: true,
      },
    });

    res.json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
});

settingsRouter.post('/api-keys', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { provider, key, label } = req.body;

    if (!provider || !key) {
      throw new AppError('Provider and key are required', 400);
    }
    if (!VALID_PROVIDERS.includes(provider)) {
      throw new AppError('Invalid provider', 400);
    }
    if (typeof key !== 'string' || key.length < 8) {
      throw new AppError('API key looks invalid (too short)', 400);
    }

    // Encrypt the plaintext key immediately — never persist it in cleartext
    const encryptedKey = encrypt(key);
    const fingerprint = sha256(key.trim());
    const prefix = keyPrefix(key, 8);

    // Enforce per-user unique fingerprint (no duplicate keys)
    const existing = await prisma.apiKey.findUnique({
      where: {
        userId_provider_keyFingerprint: {
          userId: req.userId!,
          provider: provider as any,
          keyFingerprint: fingerprint,
        },
      },
    });
    if (existing) {
      throw new AppError('This API key is already saved', 409);
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        id: uuid(),
        userId: req.userId!,
        provider: provider as any,
        label: label || provider,
        encryptedKey,
        keyFingerprint: fingerprint,
        keyPrefix: prefix,
      },
      select: {
        id: true,
        provider: true,
        label: true,
        keyPrefix: true,
        isActive: true,
        createdAt: true,
      },
    });

    ActivityLogService.log({
      userId: req.userId!,
      action: 'apikey.added',
      resource: 'api_key',
      resourceId: apiKey.id,
      metadata: { provider },
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: apiKey });
  } catch (error) {
    next(error);
  }
});

settingsRouter.delete('/api-keys/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await prisma.apiKey.deleteMany({
      where: { id, userId: req.userId },
    });

    if (result.count === 0) {
      throw new AppError('API key not found', 404);
    }

    ActivityLogService.log({
      userId: req.userId!,
      action: 'apikey.deleted',
      resource: 'api_key',
      resourceId: id,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'API key deleted' });
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/api-keys/:id/toggle', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const key = await prisma.apiKey.findFirst({
      where: { id, userId: req.userId },
    });

    if (!key) throw new AppError('API key not found', 404);

    const updated = await prisma.apiKey.update({
      where: { id: key.id },
      data: { isActive: !key.isActive },
      select: { id: true, provider: true, label: true, isActive: true },
    });

    ActivityLogService.log({
      userId: req.userId!,
      action: 'apikey.toggled',
      resource: 'api_key',
      resourceId: id,
      metadata: { isActive: updated.isActive },
      ipAddress: req.ip,
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});
