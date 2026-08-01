/**
 * OCR Routes
 *
 * POST /ocr/extract   - Extract text from an uploaded image
 * POST /ocr/compress  - Extract text from an image AND compress it in one call
 */

import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { ocrService } from '../services/ocr.service';
import type { OcrLanguage } from '../services/ocr.service';
import { SupervisorAgent } from '../agents';
import { CompressionLevel } from '../agents/types';
import { ActivityLogService } from '../services/activity-log.service';
import { v4 as uuid } from 'uuid';

export const ocrRouter = Router();
const supervisor = new SupervisorAgent();

// In-memory storage so we can process images without hitting disk twice
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB for images
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif', 'image/bmp'];
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp'];
    if (allowed.includes(file.mimetype) || allowedExts.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not supported for OCR. Use PNG, JPG, WebP, GIF, or BMP.`));
    }
  },
});

/**
 * POST /ocr/extract - Extract text from an uploaded image.
 */
ocrRouter.post('/extract', authenticate, upload.single('image'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No image uploaded', 400);

    const language = ((req.body.language as string) || 'eng') as OcrLanguage;

    const result = await ocrService.extractFromBuffer(req.file.buffer, language);

    ActivityLogService.log({
      userId: req.userId!,
      action: 'document.uploaded',
      resource: 'ocr',
      resourceId: uuid(),
      metadata: {
        filename: req.file.originalname,
        size: req.file.size,
        confidence: result.confidence,
        wordsExtracted: result.words,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
        ...result,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /ocr/compress - Extract text from an image and immediately compress it.
 * Returns both the OCR result and the compression result.
 */
ocrRouter.post('/compress', authenticate, upload.single('image'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No image uploaded', 400);

    const language = ((req.body.language as string) || 'eng') as OcrLanguage;
    const compressionLevel = ((req.body.level as string) || 'medium') as CompressionLevel;
    const llmProvider = (req.body.llmProvider as string) || 'openai';

    // Step 1: OCR
    const ocrResult = await ocrService.extractFromBuffer(req.file.buffer, language);

    if (!ocrResult.text || ocrResult.text.trim().length === 0) {
      throw new AppError('No text was extracted from the image', 400);
    }

    // Step 2: Compress the extracted text through the multi-agent pipeline
    const compression = await supervisor.orchestrate({
      text: ocrResult.text,
      userId: req.userId!,
      compressionLevel,
      llmProvider,
      filename: req.file.originalname,
    });

    if (compression.status === 'failed') {
      throw new AppError(`Compression failed: ${compression.error}`, 500);
    }

    res.json({
      success: true,
      data: {
        ocr: {
          filename: req.file.originalname,
          size: req.file.size,
          mimeType: req.file.mimetype,
          ...ocrResult,
        },
        compression: {
          id: compression.id,
          originalText: ocrResult.text,
          compressedText: compression.compressedText,
          originalTokens: compression.analytics?.originalTokens ?? 0,
          compressedTokens: compression.analytics?.compressedTokens ?? 0,
          compressionRatio: compression.analytics?.compressionRatio ?? 0,
          semanticScore: compression.analytics?.semanticScore ?? 0,
          costSavings: compression.analytics?.costSavings ?? 0,
          processingTimeMs: compression.totalExecutionTimeMs,
        },
        totalSavings: {
          visionTokensAvoided: ocrResult.savings.estimatedVisionTokens,
          compressedTokens: compression.analytics?.compressedTokens ?? 0,
          totalTokenReduction: ocrResult.savings.estimatedVisionTokens -
            (compression.analytics?.compressedTokens ?? ocrResult.savings.extractedTextTokens),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /ocr/languages - List supported OCR languages
 */
ocrRouter.get('/languages', authenticate, (_req, res) => {
  res.json({
    success: true,
    data: [
      { code: 'eng', name: 'English' },
      { code: 'spa', name: 'Spanish' },
      { code: 'fra', name: 'French' },
      { code: 'deu', name: 'German' },
      { code: 'ita', name: 'Italian' },
      { code: 'por', name: 'Portuguese' },
      { code: 'hin', name: 'Hindi' },
      { code: 'chi_sim', name: 'Chinese (Simplified)' },
      { code: 'jpn', name: 'Japanese' },
    ],
  });
});
