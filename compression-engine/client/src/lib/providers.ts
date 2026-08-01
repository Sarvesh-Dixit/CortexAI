/**
 * LLM Provider metadata (client-side).
 * Backend source of truth is llm-connector.service.ts; this mirror is used
 * for offline model dropdowns and cost estimates.
 */

export interface LLMProviderInfo {
  id: string;
  name: string;
  model: string;              // default model
  models: string[];           // available model IDs
  contextWindow: number;
  speedRating: 'fast' | 'medium' | 'slow';
  costPer1kTokens: number;
  description: string;
}

export const LLM_PROVIDERS: LLMProviderInfo[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    model: 'gpt-4o-mini',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo'],
    contextWindow: 128000,
    speedRating: 'fast',
    costPer1kTokens: 0.00015,
    description: 'Most versatile model, great for general tasks',
  },
  {
    id: 'gemini',
    name: 'Google Gemini',
    model: 'gemini-1.5-flash',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-1.5-flash-8b', 'gemini-2.0-flash-exp'],
    contextWindow: 1000000,
    speedRating: 'fast',
    costPer1kTokens: 0.0025,
    description: 'Massive context window, cost-effective',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    model: 'claude-3-5-haiku-20241022',
    models: [
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
      'claude-3-sonnet-20240229',
      'claude-3-haiku-20240307',
    ],
    contextWindow: 200000,
    speedRating: 'medium',
    costPer1kTokens: 0.00025,
    description: 'Excellent for reasoning and long documents',
  },
  {
    id: 'llama',
    name: 'Meta Llama',
    model: 'llama-3.3-70b-instruct',
    models: [
      'llama-3.3-70b-instruct',
      'llama-3.2-90b-instruct',
      'llama-3.2-11b-instruct',
      'llama-3.1-70b-instruct',
      'llama-3.1-8b-instruct',
    ],
    contextWindow: 128000,
    speedRating: 'medium',
    costPer1kTokens: 0.001,
    description: 'Open-source, very cost-effective',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    model: 'deepseek-chat',
    models: ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder'],
    contextWindow: 128000,
    speedRating: 'fast',
    costPer1kTokens: 0.00014,
    description: 'Strong for code and technical tasks',
  },
  {
    id: 'mistral',
    name: 'Mistral AI',
    model: 'mistral-small-latest',
    models: ['mistral-large-latest', 'mistral-small-latest', 'ministral-8b-latest', 'codestral-latest'],
    contextWindow: 32000,
    speedRating: 'fast',
    costPer1kTokens: 0.001,
    description: 'Balanced performance and cost',
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    model: 'llama3',
    models: ['llama3', 'llama3.2', 'mistral', 'phi3', 'gemma2', 'qwen2.5', 'deepseek-coder'],
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
