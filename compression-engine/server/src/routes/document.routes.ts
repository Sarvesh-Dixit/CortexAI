import { Router, Response, NextFunction } from 'express';
import multer, { MulterError } from 'multer';
import path from 'path';
import fs from 'fs/promises';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  estimateTokens,
  detectDocumentType,
  detectLanguage,
  countWords,
  countCharacters,
} from '../utils/tokens';
import { ActivityLogService } from '../services/activity-log.service';
import { v4 as uuid } from 'uuid';
import { logger } from '../utils/logger';

export const documentRouter = Router();

const uploadsDir = path.join(process.cwd(), 'uploads');

(async () => {
  try {
    await fs.mkdir(uploadsDir, { recursive: true });
  } catch (err) {
    logger.warn(`[Documents] Failed to create uploads dir: ${(err as Error).message}`);
  }
})();

const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    try {
      await fs.mkdir(uploadsDir, { recursive: true });
    } catch {
      /* swallow - diskStorage will throw on its own */
    }
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueName = `${uuid()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_EXTENSIONS = new Set([
  '.txt', '.pdf', '.docx', '.md', '.json', '.csv',
  '.py', '.js', '.ts', '.java', '.cpp', '.c', '.log',
  '.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff',
]);

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  if (ALLOWED_EXTENSIONS.has(ext)) {
    cb(null, true);
  } else {
    cb(new AppError(`File type ${ext || 'none'} not supported for document upload`, 400));
  }
};

const upload = multer({
  storage,
  fileFilter,
});

function multerSingle(name: string) {
  const handler = upload.single(name);
  return (req: any, _res: Response, next: NextFunction) => {
    handler(req, _res, (err: any) => {
      if (err instanceof MulterError) {
        const detail =
          err.code === 'LIMIT_UNEXPECTED_FILE'
            ? `Unexpected upload field '${err.field}'. Expected field name is '${name}'.`
            : err.code === 'LIMIT_FILE_SIZE'
              ? 'File is too large for this server to accept.'
              : err.message;
        return next(new AppError(`Upload failed: ${detail} (multer ${err.code})`, 400));
      }
      if (err instanceof AppError) return next(err);
      if (err) return next(new AppError(`Upload failed: ${(err as Error).message}`, 400));
      next();
    });
  };
}

async function extractContent(filePath: string, _mimeType: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName || '').toLowerCase();
  const PLAINTEXT_EXTS = new Set([
    '.txt', '.md', '.json', '.csv', '.py', '.js', '.ts', '.java',
    '.cpp', '.c', '.log',
  ]);

  if (PLAINTEXT_EXTS.has(ext)) {
    return await fs.readFile(filePath, 'utf-8');
  }
  if (ext === '.pdf') {
    try {
      const pdfParse = await import('pdf-parse');
      const dataBuffer = await fs.readFile(filePath);
      const data = await pdfParse.default(dataBuffer);
      return typeof data.text === 'string' ? data.text : '';
    } catch {
      return await fs.readFile(filePath, 'utf-8').catch(() => '');
    }
  }
  if (ext === '.docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return typeof result.value === 'string' ? result.value : '';
    } catch {
      return await fs.readFile(filePath, 'utf-8').catch(() => '');
    }
  }
  const plaintext = await fs.readFile(filePath, 'utf-8').catch(() => '');
  if (plaintext.length > 0) return plaintext;
  throw new AppError(
    `Could not extract text content from file type "${ext}". Supported text-based types: txt, md, json, csv, pdf, docx, and code files.`,
    422
  );
}

documentRouter.post(
  '/upload',
  authenticate,
  multerSingle('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        throw new AppError(
          `No file uploaded. Expected field name "file", multipart/form-data. Got Content-Type=${req.headers['content-type'] || '(none)'}`,
          400
        );
      }

      const content = await extractContent(file.path, file.mimetype, file.originalname);
      const documentType = detectDocumentType(content, file.originalname);
      const language = detectLanguage(content);
      const words = countWords(content);
      const characters = countCharacters(content);
      const tokens = estimateTokens(content, documentType);

      const document = await prisma.document.create({
        data: {
          id: uuid(),
          userId: req.userId!,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
          words,
          characters,
          tokens,
          content,
          documentType: documentType as any,
          language,
          storagePath: file.filename,
        },
      });

      ActivityLogService.log({
        userId: req.userId!,
        action: 'document.uploaded',
        resource: 'document',
        resourceId: document.id,
        metadata: { filename: file.originalname, size: file.size, tokens },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      }).catch((e) => logger.warn(`[Documents /upload] activity log failed: ${e.message}`));

      res.status(201).json({
        success: true,
        data: {
          id: document.id,
          filename: document.originalName,
          size: document.size,
          words,
          characters,
          tokens,
          documentType,
          language,
          content: content.slice(0, 5000),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

documentRouter.post(
  '/preview',
  authenticate,
  multerSingle('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        throw new AppError(
          `No file uploaded. Expected field name "file", multipart/form-data. Got Content-Type=${req.headers['content-type'] || '(none)'}`,
          400
        );
      }

      const content = await extractContent(file.path, file.mimetype, file.originalname);
      const documentType = detectDocumentType(content, file.originalname);
      const language = detectLanguage(content);
      const words = countWords(content);
      const characters = countCharacters(content);
      const tokens = estimateTokens(content, documentType);

      try {
        await fs.unlink(file.path);
      } catch {
        /* swallow preview cleanup */
      }

      res.json({
        success: true,
        data: {
          filename: file.originalname,
          size: file.size,
          mimeType: file.mimetype,
          words,
          characters,
          tokens,
          documentType,
          language,
          estimatedCompression: 'medium',
          preview: content.slice(0, 2000),
          contentLength: content.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

documentRouter.post(
  '/extract',
  authenticate,
  multerSingle('file'),
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const file = (req as any).file as Express.Multer.File | undefined;
      if (!file) {
        throw new AppError(
          `No file uploaded. Expected field name "file", multipart/form-data. Got Content-Type=${req.headers['content-type'] || '(none)'}`,
          400
        );
      }

      const content = await extractContent(file.path, file.mimetype, file.originalname);
      const documentType = detectDocumentType(content, file.originalname);
      const language = detectLanguage(content);

      try {
        await fs.unlink(file.path);
      } catch {
        /* swallow cleanup */
      }

      res.json({
        success: true,
        data: {
          filename: file.originalname,
          content,
          documentType,
          language,
          metadata: {
            size: file.size,
            mimeType: file.mimetype,
            words: countWords(content),
            characters: countCharacters(content),
            tokens: estimateTokens(content, documentType),
            lines: content.split('\n').length,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

documentRouter.get('/', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const documents = await prisma.document.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        originalName: true,
        mimeType: true,
        size: true,
        words: true,
        characters: true,
        tokens: true,
        documentType: true,
        language: true,
        createdAt: true,
      },
    });

    res.json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
});

documentRouter.get('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const document = await prisma.document.findFirst({
      where: { id, userId: req.userId },
    });

    if (!document) throw new AppError('Document not found', 404);
    res.json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
});

documentRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { originalName } = req.body as { originalName?: string };
    const document = await prisma.document.findFirst({
      where: { id, userId: req.userId },
    });
    if (!document) throw new AppError('Document not found', 404);
    const updated = await prisma.document.update({
      where: { id },
      data: {
        ...(originalName && { originalName }),
      },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
});

documentRouter.get('/:id/download', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = queryToken || headerToken;
    if (!token) throw new AppError('Authentication required', 401);

    const jwt = await import('jsonwebtoken');
    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      userId = decoded.userId;
    } catch {
      throw new AppError('Invalid token', 401);
    }

    const document = await prisma.document.findFirst({
      where: { id, userId },
    });
    if (!document) throw new AppError('Document not found', 404);

    const filePath = path.join(uploadsDir, document.filename);
    try {
      await fs.access(filePath);
    } catch {
      throw new AppError('File not found on disk', 404);
    }
    const stat = await fs.stat(filePath);
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.originalName)}"`
    );
    res.setHeader('Content-Length', String(stat.size));

    const stream = (await import('fs')).createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err: Error) => {
      next(new AppError(`File read error: ${err.message}`, 500));
    });
  } catch (error) {
    next(error);
  }
});

documentRouter.get('/:id/raw', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = queryToken || headerToken;
    if (!token) throw new AppError('Authentication required', 401);

    const jwt = await import('jsonwebtoken');
    let userId: string;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      userId = decoded.userId;
    } catch {
      throw new AppError('Invalid token', 401);
    }

    const document = await prisma.document.findFirst({
      where: { id, userId },
    });
    if (!document) throw new AppError('Document not found', 404);

    const filePath = path.join(uploadsDir, document.filename);
    try {
      await fs.access(filePath);
    } catch {
      throw new AppError('File not found on disk', 404);
    }
    const stat = await fs.stat(filePath);

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(document.originalName)}"`
    );
    res.setHeader('Content-Length', String(stat.size));

    const stream = (await import('fs')).createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err: Error) => {
      next(new AppError(`File read error: ${err.message}`, 500));
    });
  } catch (error) {
    next(error);
  }
});

documentRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const document = await prisma.document.findFirst({
      where: { id, userId: req.userId },
    });
    if (!document) throw new AppError('Document not found', 404);

    const filePath = path.join(uploadsDir, document.filename);
    try {
      await fs.access(filePath);
      await fs.unlink(filePath);
    } catch {
      /* swallow deletion errors - DB record is what matters */
    }

    await prisma.document.delete({ where: { id: document.id } });

    ActivityLogService.log({
      userId: req.userId!,
      action: 'document.deleted',
      resource: 'document',
      resourceId: document.id,
      metadata: { filename: document.originalName },
      ipAddress: req.ip,
    }).catch((e) => logger.warn(`[Documents DELETE] activity log failed: ${e.message}`));

    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
});
