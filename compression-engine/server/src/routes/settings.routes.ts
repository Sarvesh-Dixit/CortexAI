import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { v4 as uuid } from 'uuid';

export const settingsRouter = Router();

settingsRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        theme: true,
        language: true,
        preferredLlm: true,
        defaultCompression: true,
      },
    });

    const apiKeys = await prisma.apiKey.findMany({
      where: { userId: req.userId },
      select: {
        id: true,
        provider: true,
        label: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.json({
      success: true,
      data: { ...user, apiKeys },
    });
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
        theme: true,
        language: true,
        preferredLlm: true,
        defaultCompression: true,
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

    const validProviders = ['openai', 'gemini', 'claude', 'llama', 'deepseek', 'mistral', 'ollama'];
    if (!validProviders.includes(provider)) {
      throw new AppError('Invalid provider', 400);
    }

    const apiKey = await prisma.apiKey.create({
      data: {
        id: uuid(),
        userId: req.userId!,
        provider,
        key,
        label: label || provider,
      },
      select: {
        id: true,
        provider: true,
        label: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json({ success: true, data: apiKey });
  } catch (error) {
    next(error);
  }
});

settingsRouter.delete('/api-keys/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await prisma.apiKey.deleteMany({
      where: { id, userId: req.userId },
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

    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});
