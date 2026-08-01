/**
 * LLM Provider metadata.
 * Used across the app for provider selection, cost estimation, and display.
 */

export interface LLMProviderInfo {
  id: string;
  name: string;
  model: string;
  contextWindow: number;
  speedRating: 'fast' | 'medium' | 'slow';
  costPer1kTokens: number;
  logo?: string;
  description: string;
}

export const LLM_PROVIDERS: LLMProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    model: 'GPT-4',
    contextWindow: 128000,
    speedRating: 'fast',
    costPer1kTokens: 0.03,
    description: 'Most versatile model, great for general tasks',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    model: 'Gemini Pro',
    contextWindow: 1000000,
    speedRating: 'fast',
    costPer1kTokens: 0.0025,
    description: 'Massive context window, cost-effective',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    model: 'Claude 3 Sonnet',
    contextWindow: 200000,
    speedRating: 'medium',
    costPer1kTokens: 0.025,
    description: 'Excellent for reasoning and long documents',
  },
  {
    id: 'llama',
    name: 'Meta Llama',
    model: 'Llama 3',
    contextWindow: 128000,
    speedRating: 'medium',
    costPer1kTokens: 0.001,
    description: 'Open-source, very cost-effective',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'DeepSeek V2',
    contextWindow: 128000,
    speedRating: 'fast',
    costPer1kTokens: 0.002,
    description: 'Strong for code and technical tasks',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    model: 'Mistral Large',
    contextWindow: 32000,
    speedRating: 'fast',
    costPer1kTokens: 0.008,
    description: 'Balanced performance and cost',
  },
  {
    id: 'qwen',
    name: 'Qwen',
    model: 'Qwen 2.5',
    contextWindow: 128000,
    speedRating: 'fast',
    costPer1kTokens: 0.0015,
    description: 'Strong multilingual capabilities',
  },
  {
    id: 'gemma',
    name: 'Gemma',
    model: 'Gemma 2',
    contextWindow: 8192,
    speedRating: 'fast',
    costPer1kTokens: 0.0005,
    description: 'Lightweight and efficient',
  },
  {
    id: 'ollama',
    name: 'Ollama',
    model: 'Local Model',
    contextWindow: 8192,
    speedRating: 'slow',
    costPer1kTokens: 0,
    description: 'Run models locally for privacy',
  },
];

export function getProvider(id: string): LLMProviderInfo | undefined {
  return LLM_PROVIDERS.find((p) => p.id === id);
}

export function formatContextWindow(tokens: number): string {
  if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(0)}K`;
  return String(tokens);
}
