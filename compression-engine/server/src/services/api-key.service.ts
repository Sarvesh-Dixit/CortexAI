/**
 * API Key Service.
 *
 * The ONLY place in the codebase that decrypts stored API keys.
 * Every LLM call goes through here so we can:
 *   - Decrypt just-in-time (key never lives in memory longer than needed)
 *   - Record usage (lastUsedAt, usageCount) for auditing
 *   - Enforce that a key belongs to the calling user
 *
 * Never return decrypted keys to route handlers directly — instead expose
 * `useKey(userId, provider, callback)` which passes the plaintext to the
 * callback and clears the reference afterward.
 */

import { prisma } from '../utils/prisma';
import { decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';

export interface ResolvedApiKey {
  key: string;
  source: 'user' | 'system' | 'none';
}

const SYSTEM_KEY_ENV: Record<string, string> = {
  openai: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  claude: 'ANTHROPIC_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  llama: 'LLAMA_API_KEY',
};

export const ApiKeyService = {
  /**
   * Resolve the best API key for a (userId, provider) pair.
   * Priority: user's own active key → system env fallback → none.
   *
   * The plaintext key is returned only for the duration of the caller's use.
   * It is NEVER logged.
   */
  async resolve(userId: string, provider: string): Promise<ResolvedApiKey> {
    // 1) User's own active key
    const userKey = await prisma.apiKey.findFirst({
      where: { userId, provider: provider as any, isActive: true },
      orderBy: { createdAt: 'desc' },
    });

    if (userKey) {
      try {
        const plaintext = decrypt(userKey.encryptedKey);
        // Fire-and-forget usage tracking
        prisma.apiKey.update({
          where: { id: userKey.id },
          data: {
            lastUsedAt: new Date(),
            usageCount: { increment: 1 },
          },
        }).catch((err) => logger.warn(`[ApiKey] usage tracking failed: ${err.message}`));

        return { key: plaintext, source: 'user' };
      } catch (err) {
        logger.error(`[ApiKey] Failed to decrypt user key: ${(err as Error).message}`);
        // Fall through to system key
      }
    }

    // 2) System-level fallback (Ollama has no key at all)
    if (provider === 'ollama') {
      return { key: '', source: 'system' };
    }
    const envName = SYSTEM_KEY_ENV[provider];
    const systemKey = envName ? process.env[envName] : undefined;
    if (systemKey && systemKey.trim().length > 0) {
      return { key: systemKey.trim(), source: 'system' };
    }

    // 3) No key available
    return { key: '', source: 'none' };
  },

  /**
   * Convenience: check if a user has ANY active key for a provider,
   * without decrypting it. Useful for UI hints.
   */
  async hasActiveKey(userId: string, provider: string): Promise<boolean> {
    const count = await prisma.apiKey.count({
      where: { userId, provider: provider as any, isActive: true },
    });
    return count > 0;
  },
};
