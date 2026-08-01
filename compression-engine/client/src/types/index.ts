/**
 * Global type definitions.
 */

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  role: string;
  theme?: string;
  language?: string;
  preferredLlm?: string;
  defaultCompression?: string;
  createdAt?: string;
}

export type CompressionLevel = 'low' | 'medium' | 'high' | 'extreme';

export type LLMProvider = 'openai' | 'gemini' | 'claude' | 'llama' | 'deepseek' | 'mistral' | 'ollama' | 'qwen' | 'gemma';

export type DocumentType =
  | 'code' | 'logs' | 'research_paper' | 'email' | 'technical_documentation'
  | 'chat_history' | 'legal_document' | 'json' | 'markdown' | 'csv' | 'text';

export interface CompressionResult {
  id: string;
  originalText: string;
  compressedText: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  semanticScore: number;
  documentType: string;
  language: string;
  originalCost: number;
  compressedCost: number;
  costSavings: number;
  latency: number;
  removedSections: string[];
  modifiedSections: Array<{ original: string; modified: string }>;
  pipeline?: {
    totalTimeMs: number;
    agentsExecuted: number;
    agentResults: Array<{ agent: string; status: string; timeMs: number }>;
    validation?: {
      semanticSimilarity: number;
      compressionRatio: number;
      estimatedAccuracy: number;
      reasoningRetention: number;
      approved: boolean;
      issues: string[];
    };
  };
}

export interface CompressionRecord {
  id: string;
  originalText: string;
  compressedText: string;
  originalTokens: number;
  compressedTokens: number;
  compressionRatio: number;
  semanticScore: number;
  compressionLevel: string;
  llmProvider: string;
  documentType: string;
  costSavings: number;
  status: string;
  createdAt: string;
}

export interface DocumentRecord {
  id: string;
  originalName: string;
  mimeType: string;
  size: number;
  words: number | null;
  characters: number | null;
  tokens: number | null;
  documentType: string;
  createdAt: string;
  content?: string;
}

export interface AnalysisResult {
  words: number;
  characters: number;
  tokens: number;
  sentences: number;
  documentType: string;
  readabilityScore: number;
  costs: Record<string, number>;
  recommendation: string;
}

export interface OverviewAnalytics {
  totalPrompts: number;
  totalTokensSaved: number;
  avgCompression: number;
  avgAccuracy: number;
  totalMoneySaved: number;
  avgLatencyReduction: number;
}

export interface TrendData {
  date: string;
  compressions: number;
  avgRatio: number;
  avgAccuracy: number;
  tokensSaved: number;
  costSaved: number;
}

export interface DocTypeData {
  type: string;
  count: number;
  percentage: number;
}

export interface ApiKeyRecord {
  id: string;
  provider: string;
  label: string;
  isActive: boolean;
  createdAt: string;
}

export interface Settings {
  theme: string;
  language: string;
  preferredLlm: string;
  defaultCompression: string;
  apiKeys: ApiKeyRecord[];
}

export interface NotificationItem {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message?: string;
  timestamp: number;
  read: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: { message: string };
}
