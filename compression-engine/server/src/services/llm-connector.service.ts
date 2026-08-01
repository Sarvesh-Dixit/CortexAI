/**
 * LLM Connector Service.
 * 
 * Real HTTP integration for OpenAI, Gemini, Claude, Ollama.
 * Others fall back to simulated responses (until keys/SDKs are wired up).
 * 
 * Key precedence:
 *   1. User's own API key (from ApiKey table via caller)
 *   2. System-level fallback key from environment
 *   3. Fail with a clear message
 */

import { logger } from '../utils/logger';

export interface LLMProvider {
  name: string;
  model: string;
  maxTokens: number;
  costPer1kInput: number;
  costPer1kOutput: number;
  estimatedLatencyPerToken: number;
}

export interface LLMRequest {
  prompt: string;
  maxTokens?: number;
  temperature?: number;
  provider: string;
  apiKey?: string;
}

export interface LLMResponse {
  text: string;
  tokens: number;
  provider: string;
  model: string;
  latencyMs: number;
  cost: number;
  usedUserKey: boolean;
  simulated: boolean;
}

const PROVIDERS: Record<string, LLMProvider> = {
  openai: {
    name: 'OpenAI',
    model: 'gpt-4o-mini',
    maxTokens: 128000,
    costPer1kInput: 0.00015,
    costPer1kOutput: 0.0006,
    estimatedLatencyPerToken: 0.05,
  },
  gemini: {
    name: 'Google Gemini',
    model: 'gemini-1.5-flash',
    maxTokens: 1000000,
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.005,
    estimatedLatencyPerToken: 0.04,
  },
  claude: {
    name: 'Anthropic Claude',
    model: 'claude-3-haiku-20240307',
    maxTokens: 200000,
    costPer1kInput: 0.00025,
    costPer1kOutput: 0.00125,
    estimatedLatencyPerToken: 0.06,
  },
  llama: {
    name: 'Meta Llama',
    model: 'llama-3',
    maxTokens: 128000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.002,
    estimatedLatencyPerToken: 0.08,
  },
  deepseek: {
    name: 'DeepSeek',
    model: 'deepseek-chat',
    maxTokens: 128000,
    costPer1kInput: 0.00014,
    costPer1kOutput: 0.00028,
    estimatedLatencyPerToken: 0.07,
  },
  mistral: {
    name: 'Mistral AI',
    model: 'mistral-small-latest',
    maxTokens: 32000,
    costPer1kInput: 0.001,
    costPer1kOutput: 0.003,
    estimatedLatencyPerToken: 0.05,
  },
  ollama: {
    name: 'Ollama (Local)',
    model: 'llama3',
    maxTokens: 8192,
    costPer1kInput: 0,
    costPer1kOutput: 0,
    estimatedLatencyPerToken: 0.1,
  },
};

/** Provider ID → environment variable name for system-level fallback key */
const SYSTEM_KEY_ENV: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  llama: 'LLAMA_API_KEY',
};

export class LLMConnectorService {
  getProvider(name: string): LLMProvider | null {
    return PROVIDERS[name] || null;
  }

  getAllProviders(): LLMProvider[] {
    return Object.values(PROVIDERS);
  }

  getProviderNames(): string[] {
    return Object.keys(PROVIDERS);
  }

  estimateCost(tokens: number, provider: string, direction: 'input' | 'output' = 'input'): number {
    const p = PROVIDERS[provider];
    if (!p) return 0;
    const rate = direction === 'input' ? p.costPer1kInput : p.costPer1kOutput;
    return (tokens / 1000) * rate;
  }

  estimateLatency(tokens: number, provider: string): number {
    const p = PROVIDERS[provider];
    if (!p) return 0;
    return tokens * p.estimatedLatencyPerToken;
  }

  getContextWindow(provider: string): number {
    const p = PROVIDERS[provider];
    return p ? p.maxTokens : 8192;
  }

  /**
   * Resolve which API key to use.
   * Returns { key, isUserKey } or null if no key available.
   */
  private resolveKey(providerId: string, userKey?: string): { key: string; isUserKey: boolean } | null {
    if (userKey && userKey.trim().length > 0) {
      return { key: userKey.trim(), isUserKey: true };
    }
    if (providerId === 'ollama') {
      return { key: '', isUserKey: false }; // Ollama runs locally, no key needed
    }
    const envName = SYSTEM_KEY_ENV[providerId];
    const systemKey = envName ? process.env[envName] : undefined;
    if (systemKey && systemKey.trim().length > 0) {
      return { key: systemKey.trim(), isUserKey: false };
    }
    return null;
  }

  /**
   * Send a request to an LLM provider.
   * Real HTTP calls for openai, gemini, claude, ollama.
   * Others fall back to a simulated response so the pipeline stays testable.
   */
  async send(request: LLMRequest): Promise<LLMResponse> {
    const provider = PROVIDERS[request.provider];
    if (!provider) {
      throw new Error(`Unknown LLM provider: ${request.provider}`);
    }

    const resolved = this.resolveKey(request.provider, request.apiKey);

    logger.info(`[LLM] ${provider.name} (${provider.model}) key=${resolved ? (resolved.isUserKey ? 'user' : 'system') : 'none'}`);

    // Real integrations
    try {
      if (request.provider === 'openai' && resolved) {
        return await this.callOpenAI(request, resolved.key, resolved.isUserKey);
      }
      if (request.provider === 'gemini' && resolved) {
        return await this.callGemini(request, resolved.key, resolved.isUserKey);
      }
      if (request.provider === 'claude' && resolved) {
        return await this.callClaude(request, resolved.key, resolved.isUserKey);
      }
      if (request.provider === 'ollama') {
        return await this.callOllama(request);
      }
    } catch (error) {
      logger.error(`[LLM] Real call failed for ${request.provider}: ${(error as Error).message}`);
      throw new Error(
        `${provider.name} API call failed: ${(error as Error).message}. ` +
        `Verify your API key in Settings.`
      );
    }

    // Simulated response for providers without integration yet
    return this.simulated(request, provider, resolved);
  }

  private async callOpenAI(request: LLMRequest, apiKey: string, isUserKey: boolean): Promise<LLMResponse> {
    const provider = PROVIDERS.openai;
    const start = Date.now();

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [{ role: 'user', content: request.prompt }],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 1024,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.choices?.[0]?.message?.content ?? '';
    const usage = data.usage || {};
    const promptTokens = usage.prompt_tokens || Math.ceil(request.prompt.length / 4);
    const completionTokens = usage.completion_tokens || Math.ceil(text.length / 4);

    return {
      text,
      tokens: completionTokens,
      provider: 'openai',
      model: data.model || provider.model,
      latencyMs: Date.now() - start,
      cost: this.estimateCost(promptTokens, 'openai', 'input') +
            this.estimateCost(completionTokens, 'openai', 'output'),
      usedUserKey: isUserKey,
      simulated: false,
    };
  }

  private async callGemini(request: LLMRequest, apiKey: string, isUserKey: boolean): Promise<LLMResponse> {
    const provider = PROVIDERS.gemini;
    const start = Date.now();

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${provider.model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: request.prompt }] }],
        generationConfig: {
          temperature: request.temperature ?? 0.7,
          maxOutputTokens: request.maxTokens ?? 1024,
        },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Gemini ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const usage = data.usageMetadata || {};
    const promptTokens = usage.promptTokenCount || Math.ceil(request.prompt.length / 4);
    const completionTokens = usage.candidatesTokenCount || Math.ceil(text.length / 4);

    return {
      text,
      tokens: completionTokens,
      provider: 'gemini',
      model: provider.model,
      latencyMs: Date.now() - start,
      cost: this.estimateCost(promptTokens, 'gemini', 'input') +
            this.estimateCost(completionTokens, 'gemini', 'output'),
      usedUserKey: isUserKey,
      simulated: false,
    };
  }

  private async callClaude(request: LLMRequest, apiKey: string, isUserKey: boolean): Promise<LLMResponse> {
    const provider = PROVIDERS.claude;
    const start = Date.now();

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: request.maxTokens ?? 1024,
        temperature: request.temperature ?? 0.7,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Claude ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.content?.[0]?.text ?? '';
    const usage = data.usage || {};
    const promptTokens = usage.input_tokens || Math.ceil(request.prompt.length / 4);
    const completionTokens = usage.output_tokens || Math.ceil(text.length / 4);

    return {
      text,
      tokens: completionTokens,
      provider: 'claude',
      model: provider.model,
      latencyMs: Date.now() - start,
      cost: this.estimateCost(promptTokens, 'claude', 'input') +
            this.estimateCost(completionTokens, 'claude', 'output'),
      usedUserKey: isUserKey,
      simulated: false,
    };
  }

  private async callOllama(request: LLMRequest): Promise<LLMResponse> {
    const provider = PROVIDERS.ollama;
    const start = Date.now();
    const host = process.env.OLLAMA_HOST || 'http://localhost:11434';

    const res = await fetch(`${host}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: provider.model,
        prompt: request.prompt,
        stream: false,
        options: { temperature: request.temperature ?? 0.7 },
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Ollama ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json() as any;
    const text = data.response ?? '';
    const promptTokens = data.prompt_eval_count || Math.ceil(request.prompt.length / 4);
    const completionTokens = data.eval_count || Math.ceil(text.length / 4);

    return {
      text,
      tokens: completionTokens,
      provider: 'ollama',
      model: provider.model,
      latencyMs: Date.now() - start,
      cost: 0,
      usedUserKey: false,
      simulated: false,
    };
  }

  private simulated(
    request: LLMRequest,
    provider: LLMProvider,
    resolved: { key: string; isUserKey: boolean } | null
  ): LLMResponse {
    logger.warn(`[LLM] Using simulated response for ${request.provider} (no real integration yet)`);
    const tokens = Math.ceil(request.prompt.length / 4);
    const latency = this.estimateLatency(tokens, request.provider);

    const notice = `[Simulated response — ${provider.name} integration not yet wired]\n\n` +
      `The prompt was received (${tokens} tokens). To get real responses, ` +
      `either configure ${SYSTEM_KEY_ENV[request.provider] || 'a system key'} in .env, ` +
      `or add your API key in Settings.`;

    return {
      text: notice,
      tokens,
      provider: request.provider,
      model: provider.model,
      latencyMs: latency,
      cost: this.estimateCost(tokens, request.provider, 'input'),
      usedUserKey: resolved?.isUserKey ?? false,
      simulated: true,
    };
  }
}

export const llmConnector = new LLMConnectorService();
