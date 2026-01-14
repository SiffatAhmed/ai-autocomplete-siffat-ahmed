import * as crypto from 'crypto';

export interface CacheEntry {
  content: string;
  timestamp: number;
}

export class LRUCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxSize: number;
  private ttl: number; // in milliseconds

  constructor(maxSize: number = 100, ttlSeconds: number = 300) {
    this.maxSize = maxSize;
    this.ttl = ttlSeconds * 1000;
  }

  /**
   * Generate cache key from context, position, and language
   */
  static generateKey(context: string, position: string, language: string): string {
    const data = `${context}:${position}:${language}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get value from cache if it exists and hasn't expired
   */
  get(key: string): string | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update position in LRU (delete and re-add to move to end)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.content;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: string): void {
    // Remove oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    // If key exists, remove it first (to update position)
    if (this.cache.has(key)) {
      this.cache.delete(key);
    }

    this.cache.set(key, {
      content: value,
      timestamp: Date.now(),
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    // Check if entry has expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }
}
