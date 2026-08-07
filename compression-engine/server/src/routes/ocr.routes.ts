import { Router, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import path from 'path';
import { authenticate, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import {
  ocrService,
  OCR_DEFAULT_TIMEOUT_MS,
  OCR_COMPRESS_TIMEOUT_MS,
} from '../services/ocr.service';
import type { OcrLanguage } from '../services/ocr.service';
import { SupervisorAgent } from '../agents';
import { CompressionLevel } from '../agents/types';
import { ActivityLogService } from '../services/activity-log.service';
import { v4 as uuid } from 'uuid';

export const ocrRouter = Router();
const supervisor = new SupervisorAgent();

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    const allowedMime = new Set([
      'image/png',
      'image/jpeg',
      'image/jpg',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/tiff',
    ]);
    const allowedExts = new Set([
      '.png',
      '.jpg',
      '.jpeg',
      '.webp',
      '.gif',
      '.bmp',
      '.tif',
      '.tiff',
    ]);
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (allowedMime.has(file.mimetype) || allowedExts.has(ext)) {
      cb(null, true);
    } else {
      cb(
        new AppError(
          `File type not supported for OCR (mime=${file.mimetype} ext=${ext || 'none'}). Use PNG, JPG, WebP, GIF, BMP, or TIFF.`,
          400
        )
      );
    }
  },
});

function multerSingle(name: string) {
  const handler = upload.single(name);
  return (req: any, res: Response, next: NextFunction) => {
    handler(req, res, (err: any) => {
      if (err instanceof MulterError) {
        const detail =
          err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Unexpected upload field '${err.field}'. Expected field name is '${name}'.`
            : err.code === 'LIMIT_FILE_SIZE'
              ? 'Image is too large for this server to accept.'
              : err.message;
        return next(new AppError(`Upload failed: ${detail} (multer ${err.code})`, 400));
      }
      if (err instanceof AppError) return next(err);
      if (err) return next(new AppError(`Upload failed: ${(err as Error).message}`, 400));
      next();
    });
  };
}

function withRouteTimeout<T>(
  promiseFactory: () => Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError(`${label} timed out after ${Math.round(ms / 1000)}s`, 504));
    }, ms);
    let settled = false;
    promiseFactory()
      .then((v) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      });
  });
}

function requestTimeoutMiddleware(timeoutMs: number) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    req.setTimeout(timeoutMs, () => {
      next(new AppError(`Request socket timed out after ${Math.round(timeoutMs / 1000)}s`, 504));
    });
    next();
  };
}

function logIncomingUpload(label: string) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    const file = (req as any).file as Express.Multer.File | undefined;
    const contentType = req.headers['content-type'] || '(none)';
    const contentLength = req.headers['content-length'] || '0';
    const bodyKeys = Object.keys(req.body || {});
    logger.info(
      `[OCR ${label}] contentType=${contentType} contentLength=${contentLength} hasFile=${!!file} ` +
      `fileField=${file?.fieldname || 'N/A'} fileSize=${file?.size ?? 0} fileName=${file?.originalname || 'N/A'} ` +
      `bodyKeys=${bodyKeys.join(',') || '(none)'}`
    );
    if (!file && contentType.toLowerCase().startsWith('multipart/form-data') === false) {
      logger.warn(
        `[OCR ${label}] Request Content-Type is NOT multipart/form-data. ` +
        `Client must send FormData (axios auto-generates multipart boundary if FormData passed).`
      );
    }
    next();
  };
}

ocrRouter.post(
  '/extract',
  authenticate,
  requestTimeoutMiddleware(OCR_DEFAULT_TIMEOUT_MS + 10_000),
  multerSingle('image'),
  logIncomingUpload('/extract'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        const contentType = req.headers['content-type'] || '(none)';
        const contentLength = req.headers['content-length'] || '0';
        throw new AppError(
          'No image uploaded. Make sure to send a multipart/form-data request with file in field "image". ' +
          `(received Content-Type=${contentType}, length=${contentLength})`,
          400
        );
      }

      const language = ((req.body.language as string) || 'eng') as OcrLanguage;
      logger.info(
        `[OCR Route /extract] Running OCR on ${file.originalname} (${file.size} bytes, lang=${language})`
      );

      const result = await ocrService.extractFromBuffer(
        file.buffer,
        language,
        OCR_DEFAULT_TIMEOUT_MS
      );

      ActivityLogService.log({
        userId: req.userId!,
        action: 'document.uploaded',
        resource: 'ocr',
        resourceId: uuid(),
        metadata: {
          filename: file.originalname,
          size: file.size,
          confidence: result.confidence,
          wordsExtracted: result.words,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch((e) => logger.warn(`[OCR Route /extract] activity log failed: ${e.message}`));

      logger.info(`[OCR Route /extract] Success: ${result.words} words, ${result.processingTimeMs}ms`);
      res.json({
        success: true,
        data: {
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          ...result,
        },
      });
    } catch (error) {
      logger.warn(
        `[OCR Route /extract] Failed: ${(error as Error).message}`,
        (error as Error).stack
      );
      next(error);
    }
  }
);

ocrRouter.post(
  '/compress',
  authenticate,
  requestTimeoutMiddleware(OCR_COMPRESS_TIMEOUT_MS + 10_000),
  multerSingle('image'),
  logIncomingUpload('/compress'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        const contentType = req.headers['content-type'] || '(none)';
        const contentLength = req.headers['content-length'] || '0';
        throw new AppError(
          'No image uploaded. Make sure to send a multipart/form-data request with file in field "image". ' +
          `(received Content-Type=${contentType}, length=${contentLength})`,
          400
        );
      }

      const language = ((req.body.language as string) || 'eng') as OcrLanguage;
      const compressionLevel = ((req.body.level as string) || 'medium') as CompressionLevel;
      const llmProvider = (req.body.llmProvider as string) || 'openai';

      logger.info(
        `[OCR Route /compress] Running on ${file.originalname} (${file.size} bytes, lang=${language} level=${compressionLevel})`
      );

      const ocrResult = await ocrService.extractFromBuffer(
        file.buffer,
        language,
        OCR_DEFAULT_TIMEOUT_MS
      );

      const compressionDeadline = Math.max(60_000, OCR_COMPRESS_TIMEOUT_MS - ocrResult.processingTimeMs);
      const compression = await withRouteTimeout(
        () =>
          supervisor.orchestrate({
            text: ocrResult.text,
            userId: req.userId!,
            compressionLevel,
            llmProvider,
            filename: file!.originalname,
          }),
        compressionDeadline,
        'OCR+Compression pipeline'
      );

      if (compression.status === 'failed') {
        throw new AppError(`Compression failed: ${compression.error}`, 500);
      }

      logger.info(
        `[OCR Route /compress] Success: OCR ${ocrResult.processingTimeMs}ms / compress ${compression.totalExecutionTimeMs}ms`
      );
      res.json({
        success: true,
        data: {
          ocr: {
            filename: file.originalname,
            size: file.size,
            mimeType: file.mimetype,
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
            totalTokenReduction:
              ocrResult.savings.estimatedVisionTokens -
              (compression.analytics?.compressedTokens ?? ocrResult.savings.extractedTextTokens),
          },
        },
      });
    } catch (error) {
      logger.warn(
        `[OCR Route /compress] Failed: ${(error as Error).message}`,
        (error as Error).stack
      );
      next(error);
    }
  }
);

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
