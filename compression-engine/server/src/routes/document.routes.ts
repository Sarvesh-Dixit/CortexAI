import { Router, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticate, AuthRequest } from '../middleware/auth';
import { prisma } from '../utils/prisma';
import { AppError } from '../middleware/errorHandler';
import { estimateTokens, detectDocumentType, detectLanguage, countWords, countCharacters } from '../utils/tokens';
import { ActivityLogService } from '../services/activity-log.service';
import { v4 as uuid } from 'uuid';

export const documentRouter = Router();

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const uniqueName = `${uuid()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const ALLOWED_EXTENSIONS = [
  '.txt', '.pdf', '.docx', '.md', '.json', '.csv',
  '.py', '.js', '.ts', '.java', '.cpp', '.c', '.log',
];

const fileFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${ext} not supported`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

async function extractContent(filePath: string, _mimeType: string, originalName: string): Promise<string> {
  const ext = path.extname(originalName).toLowerCase();

  if (['.txt', '.md', '.json', '.csv', '.py', '.js', '.ts', '.java', '.cpp', '.c', '.log'].includes(ext)) {
    return fs.readFileSync(filePath, 'utf-8');
  }
  if (ext === '.pdf') {
    try {
      const pdfParse = await import('pdf-parse');
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse.default(dataBuffer);
      return data.text;
    } catch {
      return fs.readFileSync(filePath, 'utf-8');
    }
  }
  if (ext === '.docx') {
    try {
      const mammoth = await import('mammoth');
      const result = await mammoth.extractRawText({ path: filePath });
      return result.value;
    } catch {
      return fs.readFileSync(filePath, 'utf-8');
    }
  }
  return fs.readFileSync(filePath, 'utf-8');
}

/**
 * POST /documents/upload - upload and process a file
 */
documentRouter.post('/upload', authenticate, upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const content = await extractContent(req.file.path, req.file.mimetype, req.file.originalname);
    const documentType = detectDocumentType(content, req.file.originalname);
    const language = detectLanguage(content);
    const words = countWords(content);
    const characters = countCharacters(content);
    const tokens = estimateTokens(content, documentType);

    const document = await prisma.document.create({
      data: {
        id: uuid(),
        userId: req.userId!,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        words,
        characters,
        tokens,
        content,
        documentType: documentType as any,
        language,
        storagePath: req.file.filename,
      },
    });

    ActivityLogService.log({
      userId: req.userId!,
      action: 'document.uploaded',
      resource: 'document',
      resourceId: document.id,
      metadata: { filename: req.file.originalname, size: req.file.size, tokens },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

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
});

/**
 * POST /documents/preview - preview an uploaded file (extract without persisting)
 */
documentRouter.post('/preview', authenticate, upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const content = await extractContent(req.file.path, req.file.mimetype, req.file.originalname);
    const documentType = detectDocumentType(content, req.file.originalname);
    const language = detectLanguage(content);
    const words = countWords(content);
    const characters = countCharacters(content);
    const tokens = estimateTokens(content, documentType);

    // Clean up temp file - preview doesn't persist
    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        size: req.file.size,
        mimeType: req.file.mimetype,
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
});

/**
 * POST /documents/extract - extract structured content from a file
 * Returns metadata + full content (respects size limits)
 */
documentRouter.post('/extract', authenticate, upload.single('file'), async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);

    const content = await extractContent(req.file.path, req.file.mimetype, req.file.originalname);
    const documentType = detectDocumentType(content, req.file.originalname);
    const language = detectLanguage(content);

    fs.unlinkSync(req.file.path);

    res.json({
      success: true,
      data: {
        filename: req.file.originalname,
        content,
        documentType,
        language,
        metadata: {
          size: req.file.size,
          mimeType: req.file.mimetype,
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
});

/**
 * GET /documents - list all documents for the current user
 */
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

/**
 * GET /documents/:id - fetch a single document with content
 */
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

/**
 * PUT /documents/:id - update document metadata (e.g., rename)
 */
documentRouter.put('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { originalName } = req.body;

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

/**
 * GET /documents/:id/download - stream the original binary file
 * Serves the file with correct MIME type and Content-Disposition header.
 * Auth via query param token to support direct browser downloads.
 */
documentRouter.get('/:id/download', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;

    // Support token via query for browser downloads (native <a href> can't set headers)
    const queryToken = typeof req.query.token === 'string' ? req.query.token : null;
    const headerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = queryToken || headerToken;

    if (!token) throw new AppError('Authentication required', 401);

    // Verify token manually to avoid the standard middleware for this route
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
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found on disk', 404);
    }

    // Set proper headers so the browser handles the file correctly
    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(document.originalName)}"`
    );
    res.setHeader('Content-Length', String(document.size));

    // Stream file to response
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err) => {
      next(new AppError(`File read error: ${err.message}`, 500));
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /documents/:id/raw - inline preview of the binary file (e.g., PDF in-browser viewer)
 */
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
    if (!fs.existsSync(filePath)) {
      throw new AppError('File not found on disk', 404);
    }

    res.setHeader('Content-Type', document.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(document.originalName)}"`);
    res.setHeader('Content-Length', String(document.size));

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err) => {
      next(new AppError(`File read error: ${err.message}`, 500));
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /documents/:id - delete a document and its file
 */
documentRouter.delete('/:id', authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const document = await prisma.document.findFirst({
      where: { id, userId: req.userId },
    });

    if (!document) throw new AppError('Document not found', 404);

    const filePath = path.join(uploadsDir, document.filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.document.delete({ where: { id: document.id } });

    ActivityLogService.log({
      userId: req.userId!,
      action: 'document.deleted',
      resource: 'document',
      resourceId: document.id,
      metadata: { filename: document.originalName },
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Document deleted' });
  } catch (error) {
    next(error);
  }
});
