import api from '../lib/api';

export interface ComparisonResult {
  original: { text: string; tokens: number; cost: number; estimatedLatency: number };
  compressed: { text: string; tokens: number; cost: number; estimatedLatency: number };
  metrics: {
    compressionRatio: number;
    semanticScore: number;
    tokensSaved: number;
    costSaved: number;
    processingTime: number;
  };
  providers: Array<{
    provider: string;
    originalCost: number;
    compressedCost: number;
    savings: number;
    savingsPercentage: number;
  }>;
  pipeline?: {
    agentsExecuted: number;
    agents: Array<{ name: string; status: string; timeMs: number }>;
    documentType: string;
    language: string;
    validation?: {
      semanticSimilarity: number;
      estimatedAccuracy: number;
      reasoningRetention: number;
      approved: boolean;
    };
  };
}

export interface TokenCountResult {
  tokens: number;
  characters: number;
  words: number;
  costs: Record<string, number>;
}

export const PlaygroundService = {
  async compressAndCompare(payload: { text: string; level: string; provider: string }): Promise<ComparisonResult> {
    const { data } = await api.post('/playground/compress-and-compare', payload);
    return data.data;
  },

  async tokenCount(text: string): Promise<TokenCountResult> {
    const { data } = await api.post('/playground/token-count', { text });
    return data.data;
  },
};
