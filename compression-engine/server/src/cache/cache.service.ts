/**
 * Cache Service
 * 
 * In-memory LRU cache for compression results.
 * Avoids reprocessing identical inputs.
 * Can be replaced with Redis in production.
 */

import { logger } from '../utils/logger';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

export class CacheService<T = unknown> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize = 500, ttlMs = 30 * 60 * 1000) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMs;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    entry.accessCount++;
    return entry.value;
  }

  set(key: string, value: T): void {
    // Evict if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evict();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      accessCount: 1,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
    logger.info('[Cache] Cache cleared');
  }

  getStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0, // Would need hit/miss counters for real implementation
    };
  }

  private evict(): void {
    // LRU eviction - remove least accessed entry
    let leastKey: string | null = null;
    let leastAccess = Infinity;

    for (const [key, entry] of this.cache) {
      if (entry.accessCount < leastAccess) {
        leastAccess = entry.accessCount;
        leastKey = key;
      }
    }

    if (leastKey) {
      this.cache.delete(leastKey);
    }
  }

  /**
   * Generate a cache key from compression parameters.
   * Uses a hash of the input text + compression level.
   */
  static generateKey(text: string, level: string): string {
    // Simple hash for cache key
    let hash = 0;
    const str = `${text}::${level}`;
    for (let i = 0; i < Math.min(str.length, 500); i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return `comp_${Math.abs(hash).toString(36)}_${text.length}`;
  }
}

// Singleton instance for compression results
export const compressionCache = new CacheService<{
  compressedText: string;
  compressionRatio: number;
  semanticScore: number;
}>(500, 60 * 60 * 1000); // 1 hour TTL
