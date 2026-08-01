/**
 * OCR Service - extracts text from images using Tesseract.js
 * 
 * Why this matters:
 *   Sending screenshots to a vision-capable LLM (GPT-4V, Gemini, Claude 3) costs
 *   dramatically more than plain text. A 1000x1000 image can cost 2-10x more
 *   than the equivalent extracted text would. By extracting the text locally
 *   with OCR, users pay only for text tokens.
 *
 * The worker is lazy-initialized once and reused across requests for performance.
 * All processing happens on the server, so no image data ever leaves the machine.
 */

import fs from 'fs';
import { createWorker, Worker, PSM } from 'tesseract.js';
import { logger } from '../utils/logger';

export interface OcrResult {
  text: string;
  confidence: number;
  language: string;
  processingTimeMs: number;
  words: number;
  lines: number;
  characters: number;
  hasLowConfidenceRegions: boolean;
  // Cost comparison: vision tokens (rough estimate) vs. extracted text tokens
  savings: {
    estimatedVisionTokens: number;
    extractedTextTokens: number;
    tokenReductionPercent: number;
  };
}

export type OcrLanguage = 'eng' | 'spa' | 'fra' | 'deu' | 'ita' | 'por' | 'hin' | 'chi_sim' | 'jpn';

const SUPPORTED_LANGUAGES: OcrLanguage[] = ['eng', 'spa', 'fra', 'deu', 'ita', 'por', 'hin', 'chi_sim', 'jpn'];

/**
 * Rough vision-token estimator.
 *
 * OpenAI GPT-4V tile pricing: high-detail images are broken into 512x512 tiles.
 * Each tile costs ~170 tokens, plus a 85-token base. Low-detail = 85 tokens flat.
 * We estimate based on file size as a proxy for image dimensions.
 */
function estimateVisionTokens(fileSizeBytes: number): number {
  // Base overhead
  let tokens = 85;
  // Rough approximation: every ~50KB of image roughly equates to one tile.
  const estimatedTiles = Math.max(1, Math.min(16, Math.ceil(fileSizeBytes / 50_000)));
  tokens += estimatedTiles * 170;
  return tokens;
}

class OcrService {
  private worker: Worker | null = null;
  private currentLanguage: OcrLanguage | null = null;
  private initializing: Promise<void> | null = null;

  /**
   * Lazy-initialize and cache the Tesseract worker.
   * Only one worker exists per process; language switches reuse it via loadLanguage.
   */
  private async ensureWorker(language: OcrLanguage = 'eng'): Promise<Worker> {
    if (this.initializing) await this.initializing;

    if (!this.worker) {
      this.initializing = (async () => {
        logger.info(`[OCR] Initializing Tesseract worker (language=${language})`);
        this.worker = await createWorker(language, 1, {
          logger: (m) => {
            if (m.status === 'recognizing text') {
              logger.debug(`[OCR] ${Math.round(m.progress * 100)}%`);
            }
          },
        });
        this.currentLanguage = language;
        // Auto page segmentation (works well for screenshots and documents)
        await this.worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        logger.info('[OCR] Worker ready');
      })();
      await this.initializing;
      this.initializing = null;
    }

    // Switch language if needed
    if (this.currentLanguage !== language) {
      logger.info(`[OCR] Switching language to ${language}`);
      await this.worker!.reinitialize(language);
      this.currentLanguage = language;
    }

    return this.worker!;
  }

  /**
   * Run OCR on an image file and return the extracted text + rich metadata.
   */
  async extractFromFile(
    filePath: string,
    language: OcrLanguage = 'eng'
  ): Promise<OcrResult> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Image file not found: ${filePath}`);
    }

    if (!SUPPORTED_LANGUAGES.includes(language)) {
      throw new Error(`Unsupported OCR language: ${language}`);
    }

    const fileSize = fs.statSync(filePath).size;
    const startTime = Date.now();
    const worker = await this.ensureWorker(language);

    const { data } = await worker.recognize(filePath);
    const processingTimeMs = Date.now() - startTime;

    const text = (data.text || '').trim();
    const confidence = data.confidence || 0;
    const words = text.split(/\s+/).filter(Boolean).length;
    const lines = text.split(/\n/).filter((l) => l.trim().length > 0).length;

    // Tesseract v6 doesn't always expose per-word blocks; approximate from confidence
    const hasLowConfidenceRegions = confidence < 70;

    // Cost savings calculation
    const estimatedVisionTokens = estimateVisionTokens(fileSize);
    const extractedTextTokens = Math.ceil(text.length / 4);
    const tokenReductionPercent = estimatedVisionTokens > 0
      ? Math.max(0, Math.round((1 - extractedTextTokens / estimatedVisionTokens) * 100))
      : 0;

    logger.info(
      `[OCR] Done in ${processingTimeMs}ms: ${words} words, confidence ${confidence.toFixed(1)}%, ` +
      `saves ~${estimatedVisionTokens - extractedTextTokens} tokens vs vision`
    );

    return {
      text,
      confidence,
      language,
      processingTimeMs,
      words,
      lines,
      characters: text.length,
      hasLowConfidenceRegions,
      savings: {
        estimatedVisionTokens,
        extractedTextTokens,
        tokenReductionPercent,
      },
    };
  }

  /**
   * Extract text from a Buffer (in-memory image).
   */
  async extractFromBuffer(
    buffer: Buffer,
    language: OcrLanguage = 'eng'
  ): Promise<OcrResult> {
    const fileSize = buffer.length;
    const startTime = Date.now();
    const worker = await this.ensureWorker(language);

    const { data } = await worker.recognize(buffer);
    const processingTimeMs = Date.now() - startTime;

    const text = (data.text || '').trim();
    const confidence = data.confidence || 0;
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

  /**
   * Cleanly shut down the worker on process exit.
   */
  async terminate(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
      this.currentLanguage = null;
    }
  }
}

export const ocrService = new OcrService();

// Terminate worker on process exit
process.on('SIGINT', () => {
  ocrService.terminate().finally(() => process.exit(0));
});
process.on('SIGTERM', () => {
  ocrService.terminate().finally(() => process.exit(0));
});
