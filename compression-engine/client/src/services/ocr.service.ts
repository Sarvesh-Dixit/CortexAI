import api from '../lib/api';
import type { AxiosError } from 'axios';

const OCR_EXTRACT_TIMEOUT = 120_000;
const OCR_COMPRESS_TIMEOUT = 180_000;

export interface OcrExtractResult {
  filename: string;
  size: number;
  mimeType: string;
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

export interface OcrCompressResult {
  ocr: OcrExtractResult;
  compression: {
    id: string;
    originalText: string;
    compressedText: string;
    originalTokens: number;
    compressedTokens: number;
    compressionRatio: number;
    semanticScore: number;
    costSavings: number;
    processingTimeMs: number;
  };
  totalSavings: {
    visionTokensAvoided: number;
    compressedTokens: number;
    totalTokenReduction: number;
  };
}

export interface OcrLanguageOption {
  code: string;
  name: string;
}

export type OcrServiceError = Error & {
  httpStatus?: number;
  errorCode?: string;
  isTimeout?: boolean;
  isNetwork?: boolean;
};

function unwrapAxiosError(err: unknown): OcrServiceError {
  const e = err as AxiosError<any> | Error;
  const out: OcrServiceError = new Error((e as Error).message || 'OCR request failed');
  (out as any).cause = err;

  if ((e as AxiosError).isAxiosError) {
    const ax = e as AxiosError<any>;
    out.httpStatus = ax.response?.status;
    out.errorCode = ax.response?.data?.error?.code;
    const serverMsg = ax.response?.data?.error?.message;
    if (typeof serverMsg === 'string' && serverMsg.length > 0) {
      out.message = serverMsg;
    }
    if (ax.code === 'ECONNABORTED' || /timeout/i.test(ax.message || '')) {
      out.isTimeout = true;
      if (!serverMsg) out.message = 'OCR request timed out — try a smaller or clearer image';
    } else if (
      ax.code === 'ERR_NETWORK' ||
      ax.code === 'ENOTFOUND' ||
      ax.code === 'ECONNREFUSED'
    ) {
      out.isNetwork = true;
      if (!serverMsg) out.message = 'Cannot reach the OCR server — check your connection or API URL';
    }
  }
  return out;
}

export const OcrService = {
  async extract(image: File, language: string = 'eng'): Promise<OcrExtractResult> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('language', language);
    try {
      const { data } = await api.post('/ocr/extract', formData, {
        timeout: OCR_EXTRACT_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        onUploadProgress: (event) => {
          if (event.total && typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent('ocr:upload-progress', {
                detail: { loaded: event.loaded, total: event.total },
              })
            );
          }
        },
      });
      return data.data;
    } catch (err) {
      throw unwrapAxiosError(err);
    }
  },

  async compress(
    image: File,
    language: string = 'eng',
    level: string = 'medium',
    provider: string = 'openai'
  ): Promise<OcrCompressResult> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('language', language);
    formData.append('level', level);
    formData.append('llmProvider', provider);
    try {
      const { data } = await api.post('/ocr/compress', formData, {
        timeout: OCR_COMPRESS_TIMEOUT,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      });
      return data.data;
    } catch (err) {
      throw unwrapAxiosError(err);
    }
  },

  async getLanguages(): Promise<OcrLanguageOption[]> {
    try {
      const { data } = await api.get('/ocr/languages', { timeout: 15_000 });
      return data.data;
    } catch (err) {
      throw unwrapAxiosError(err);
    }
  },
};
