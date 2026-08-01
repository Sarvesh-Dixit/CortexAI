import api from '../lib/api';

export interface BenchmarkPayload {
  originalPrompt: string;
  compressedPrompt?: string;   // optional; auto-generated if omitted
  provider: string;
  model?: string;
  level?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface BenchmarkTelemetry {
  tokensSaved: number;
  tokenReductionPct: number;
  latencyDelta: number;
  latencyImprovementPct: number;
  costSaved: number;
  costSavedMicroUsd: number;
  fidelity: {
    score: number;
    scorePct: number;
    cosineSimilarity: number;
    entityPreservation: number;
    lengthRatio: number;
    verdict: 'excellent' | 'good' | 'fair' | 'poor';
  };
  totalWallTimeMs: number;
  usedUserKey: boolean;
}

export interface BenchmarkResult {
  provider: string;
  model: string;
  original: {
    prompt: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    cost: number;
    response: string;
    simulated: boolean;
  };
  compressed: {
    prompt: string;
    inputTokens: number;
    outputTokens: number;
    latencyMs: number;
    cost: number;
    response: string;
    simulated: boolean;
  };
  telemetry: BenchmarkTelemetry;
  pipeline: {
    agentsExecuted: number;
    totalTimeMs: number;
    semanticScore: number;
    compressionRatio: number;
  } | null;
}

export interface ProviderModelCatalog {
  id: string;
  name: string;
  defaultModel: string;
  models: string[];
  contextWindow: number;
  costPer1kInput: number;
  costPer1kOutput: number;
}

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
  async benchmark(payload: BenchmarkPayload): Promise<BenchmarkResult> {
    const { data } = await api.post('/playground/benchmark', payload);
    return data.data;
  },

  async getModels(): Promise<ProviderModelCatalog[]> {
    const { data } = await api.get('/playground/models');
    return data.data;
  },

  async compressAndCompare(payload: { text: string; level: string; provider: string }): Promise<ComparisonResult> {
    const { data } = await api.post('/playground/compress-and-compare', payload);
    return data.data;
  },

  async tokenCount(text: string): Promise<TokenCountResult> {
    const { data } = await api.post('/playground/token-count', { text });
    return data.data;
  },
};
