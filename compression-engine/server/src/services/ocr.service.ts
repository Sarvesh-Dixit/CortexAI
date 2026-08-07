import os from 'os';
import fs from 'fs/promises';
import path from 'path';
import { createWorker, Worker, PSM } from 'tesseract.js';
import { logger } from '../utils/logger';
import { AppError } from '../middleware/errorHandler';

export interface OcrResult {
  text: string;
  confidence: number;
  language: string;
  processingTimeMs: number;
  words: number;
  lines: number;
  characters: number;
  hasLowConfidenceRegions: boolean;
  savings: {
    estimatedVisionTokens: number;
    extractedTextTokens: number;
    tokenReductionPercent: number;
  };
}

export type OcrLanguage = 'eng' | 'spa' | 'fra' | 'deu' | 'ita' | 'por' | 'hin' | 'chi_sim' | 'jpn';

const SUPPORTED_LANGUAGES: OcrLanguage[] = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'hin', 'chi_sim', 'jpn'];

export const OCR_DEFAULT_TIMEOUT_MS = 120_000;
export const OCR_COMPRESS_TIMEOUT_MS = 180_000;

const LANGUAGE_FILENAMES: Record<OcrLanguage, string> = {
  eng: 'eng.traineddata',
  spa: 'spa.traineddata',
  fra: 'fra.traineddata',
  deu: 'deu.traineddata',
  ita: 'ita.traineddata',
  por: 'por.traineddata',
  hin: 'hin.traineddata',
  chi_sim: 'chi_sim.traineddata',
  jpn: 'jpn.traineddata',
};

function estimateVisionTokens(fileSizeBytes: number): number {
  let tokens = 85;
  const estimatedTiles = Math.max(1, Math.min(16, Math.ceil(fileSizeBytes / 50_000)));
  tokens += estimatedTiles * 170;
  return tokens;
}

interface TimeoutBox {
  timedOut: boolean;
}

function withTimeout<T>(
  promiseFactory: () => Promise<T>,
  ms: number,
  label: string,
  onTimeout?: (box: TimeoutBox) => void | Promise<void>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const box: TimeoutBox = { timedOut: false };
    const timer = setTimeout(async () => {
      box.timedOut = true;
      try {
        if (onTimeout) await onTimeout(box);
      } catch {
        /* ignore cleanup errors */
      }
      reject(new AppError(`OCR ${label} timed out after ${Math.round(ms / 1000)}s`, 504));
    }, ms);

    let settled = false;
    promiseFactory()
      .then((v) => {
        if (settled || box.timedOut) return;
        settled = true;
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        if (settled || box.timedOut) return;
        settled = true;
        clearTimeout(timer);
        reject(e);
      });
  });
}

class OcrService {
  private worker: Worker | null = null;
  private currentLanguage: OcrLanguage | null = null;
  private initializing: Promise<void> | null = null;

  private getCachePath(): string {
    if (process.env.TESSERACT_CACHE_PATH) {
      return path.resolve(process.env.TESSERACT_CACHE_PATH);
    }
    const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
    if (isVercel) {
      return '/tmp/.tesseract-cache';
    }
    return path.join(os.tmpdir(), 'tesseract-cache');
  }

  private async ensureBundledLanguageAvailable(language: OcrLanguage, cachePath: string): Promise<void> {
    const filename = LANGUAGE_FILENAMES[language] || `${language}.traineddata`;
    const projectRoot = path.resolve(__dirname, '..', '..');
    const candidates = [
      path.join(projectRoot, filename),
      path.join(process.cwd(), filename),
      path.join(process.cwd(), 'tessdata', filename),
    ];
    try {
      await fs.mkdir(cachePath, { recursive: true });
    } catch {
      /* ignore */
    }
    const dest = path.join(cachePath, filename);
    try {
      await fs.access(dest, fs.constants.R_OK);
      logger.debug(`[OCR] Using cached language file: ${dest}`);
      return;
    } catch {
      /* missing, try to copy from bundled */
    }
    for (const src of candidates) {
      try {
        await fs.access(src, fs.constants.R_OK);
        logger.info(`[OCR] Copying bundled ${filename} to cache: ${src} -> ${dest}`);
        await fs.copyFile(src, dest);
        return;
      } catch {
        continue;
      }
    }
    logger.warn(`[OCR] No bundled ${filename} found locally; will try network download.`);
  }

  private async createWorkerInternal(
    language: OcrLanguage,
    cachePath: string,
    timeoutMs: number
  ): Promise<Worker> {
    await this.ensureBundledLanguageAvailable(language, cachePath);

    let workerRef: Worker | null = null;
    const make = async (): Promise<Worker> => {
      logger.info(`[OCR] createWorker start (lang=${language}, cache=${cachePath})`);
      const w = await createWorker(language, 1, {
        cachePath,
        logger: (m) => {
          if (!m || typeof m.status !== 'string') return;
          if (typeof m.progress === 'number') {
            const pct = Math.round(m.progress * 100);
            if (pct === 0 || pct === 25 || pct === 50 || pct === 75 || pct === 100) {
              logger.debug(`[OCR] ${m.status}: ${pct}%`);
            }
          } else {
            logger.debug(`[OCR] ${m.status}`);
          }
        },
      });
      workerRef = w;
      logger.info(`[OCR] createWorker resolved, setting PSM=AUTO`);
      await w.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
      logger.info(`[OCR] Worker configured ready (lang=${language})`);
      return w;
    };

    return withTimeout(
      make,
      Math.max(120_000, timeoutMs),
      `worker initialization for ${language}`,
      async () => {
        if (workerRef) {
          logger.warn(`[OCR] Init timeout reached; terminating partial worker for ${language}`);
          try {
            await workerRef.terminate();
          } catch {
            /* swallow */
          }
        }
      }
    );
  }

  private async ensureWorker(
    language: OcrLanguage = 'eng',
    timeoutMs: number = OCR_DEFAULT_TIMEOUT_MS
  ): Promise<Worker> {
    if (this.initializing) {
      await this.initializing;
    }

    const cachePath = this.getCachePath();

    if (!this.worker) {
      this.initializing = (async () => {
        try {
          this.worker = await this.createWorkerInternal(language, cachePath, timeoutMs);
          this.currentLanguage = language;
        } finally {
          this.initializing = null;
        }
      })();
      await this.initializing;
    }

    if (this.currentLanguage !== language) {
      logger.info(`[OCR] Switching language: ${this.currentLanguage} -> ${language}`);
      const previousWorker = this.worker;
      try {
        await this.ensureBundledLanguageAvailable(language, cachePath);
        await withTimeout(
          async () => {
            await previousWorker!.reinitialize(language);
            this.currentLanguage = language;
          },
          Math.max(60_000, timeoutMs),
          `language switch to ${language}`
        );
      } catch (err) {
        logger.warn(
          `[OCR] Language switch to ${language} failed (${(err as Error).message}); rebuilding worker.`
        );
        try {
          await previousWorker!.terminate();
        } catch {
          /* swallow */
        }
        this.worker = null;
        this.currentLanguage = null;
        return this.ensureWorker(language, timeoutMs);
      }
    }

    if (!this.worker) {
      throw new AppError('OCR worker unavailable', 500);
    }
    return this.worker;
  }

  private buildResult(
    text: string,
    confidence: number,
    language: OcrLanguage,
    processingTimeMs: number,
    fileSize: number
  ): OcrResult {
    const words = text.split(/\s+/).filter(Boolean).length;
    const lines = text.split(/\n/).filter((l) => l.trim().length > 0).length;
    const estimatedVisionTokens = estimateVisionTokens(fileSize);
    const extractedTextTokens = Math.ceil(text.length / 4);
    const tokenReductionPercent = estimatedVisionTokens > 0
      ? Math.max(0, Math.round((1 - extractedTextTokens / estimatedVisionTokens) * 100))
      : 0;

    return {
      text,
      confidence,
      language,
      processingTimeMs,
      words,
      lines,
      characters: text.length,
      hasLowConfidenceRegions: confidence < 70,
      savings: {
        estimatedVisionTokens,
        extractedTextTokens,
        tokenReductionPercent,
      },
    };
  }

  async extractFromFile(
    filePath: string,
    language: OcrLanguage = 'eng',
    timeoutMs: number = OCR_DEFAULT_TIMEOUT_MS
  ): Promise<OcrResult> {
    try {
      await fs.access(filePath, fs.constants.R_OK);
    } catch {
      throw new AppError(`Image file not found: ${filePath}`, 404);
    }
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new AppError(`Unsupported OCR language: ${language}`, 400);
    }
    const stats = await fs.stat(filePath);
    const fileSize = stats.size;
    return this.extractInternal(
      () => this.ensureWorker(language, timeoutMs).then((w) => w.recognize(filePath)),
      language,
      fileSize,
      timeoutMs,
      `recognize file ${path.basename(filePath)}`
    );
  }

  async extractFromBuffer(
    buffer: Buffer,
    language: OcrLanguage = 'eng',
    timeoutMs: number = OCR_DEFAULT_TIMEOUT_MS
  ): Promise<OcrResult> {
    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new AppError(`Unsupported OCR language: ${language}`, 400);
    }
    const fileSize = buffer.length;
    return this.extractInternal(
      () => this.ensureWorker(language, timeoutMs).then((w) => w.recognize(buffer)),
      language,
      fileSize,
      timeoutMs,
      `recognize buffer (${Math.round(buffer.length / 1024)} KB)`
    );
  }

  private async extractInternal(
    runRecognize: () => Promise<{ data: { text?: string; confidence?: number } }>,
    language: OcrLanguage,
    fileSize: number,
    timeoutMs: number,
    label: string
  ): Promise<OcrResult> {
    const startTime = Date.now();
    const snapshot = { worker: this.worker };
    const { data } = await withTimeout(
      runRecognize,
      timeoutMs,
      label,
      async () => {
        const w = snapshot.worker || this.worker;
        if (w) {
          logger.warn(`[OCR] Recognition timeout reached for ${label}; terminating worker to reset.`);
          try {
            await w.terminate();
          } catch {
            /* swallow */
          }
          this.worker = null;
          this.currentLanguage = null;
        }
      }
    );
    const processingTimeMs = Date.now() - startTime;

    const text = (data.text || '').trim();
    const confidence = typeof data.confidence === 'number' ? data.confidence : 0;

    if (text.length === 0) {
      logger.warn(`[OCR] Empty extraction result: ${label} (conf=${confidence.toFixed(1)})`);
      throw new AppError(
        'OCR could not extract any readable text from the image. Try a clearer or higher-resolution image.',
        422
      );
    }

    const result = this.buildResult(text, confidence, language, processingTimeMs, fileSize);
    logger.info(
      `[OCR] ${label} done in ${processingTimeMs}ms: ${result.words} words, ` +
      `confidence ${confidence.toFixed(1)}%, saves ~${result.savings.estimatedVisionTokens - result.savings.extractedTextTokens} tokens vs vision`
    );
    return result;
  }

  async terminate(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
      } catch {
        /* swallow */
      } finally {
        this.worker = null;
        this.currentLanguage = null;
      }
    }
  }
}

export const ocrService = new OcrService();

process.on('SIGINT', () => {
  ocrService.terminate().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  ocrService.terminate().finally(() => process.exit(0));
});
