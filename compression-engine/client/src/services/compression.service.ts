import api from '../lib/api';
import type { CompressionResult, CompressionRecord, AnalysisResult, CompressionLevel } from '../types';

export interface CompressPayload {
  text: string;
  level: CompressionLevel;
  llmProvider?: string;
  documentType?: string;
  filename?: string;
}

export interface HistoryParams {
  page?: number;
  limit?: number;
  search?: string;
  documentType?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
}

export interface HistoryResponse {
  compressions: CompressionRecord[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export const CompressionService = {
  async compress(payload: CompressPayload): Promise<CompressionResult> {
    const { data } = await api.post('/compression/compress', payload);
    return data.data;
  },

  async analyze(text: string, filename?: string): Promise<AnalysisResult> {
    const { data } = await api.post('/compression/analyze', { text, filename });
    return data.data;
  },

  async getHistory(params: HistoryParams = {}): Promise<HistoryResponse> {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.documentType) query.set('documentType', params.documentType);
    if (params.sortBy) query.set('sortBy', params.sortBy);
    if (params.order) query.set('order', params.order);

    const { data } = await api.get(`/compression/history?${query.toString()}`);
    return data.data;
  },

  async getHistoryItem(id: string): Promise<CompressionRecord> {
    const { data } = await api.get(`/compression/history/${id}`);
    return data.data;
  },

  async deleteHistoryItem(id: string): Promise<void> {
    await api.delete(`/compression/history/${id}`);
  },
};
