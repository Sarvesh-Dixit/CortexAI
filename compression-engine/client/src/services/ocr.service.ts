import api from '../lib/api';

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

export const OcrService = {
  async extract(image: File, language: string = 'eng'): Promise<OcrExtractResult> {
    const formData = new FormData();
    formData.append('image', image);
    formData.append('language', language);
    const { data } = await api.post('/ocr/extract', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
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
    const { data } = await api.post('/ocr/compress', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data.data;
  },

  async getLanguages(): Promise<OcrLanguageOption[]> {
    const { data } = await api.get('/ocr/languages');
    return data.data;
  },
};
