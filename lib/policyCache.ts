/**
 * High-Performance In-Memory Semantic and Query Cache for Policy RAG
 * 
 * Provides sub-millisecond (< 1ms) response times for identical or
 * semantically normalized queries, bypassing vector search and LLM synthesis.
 */

export interface CachedPolicySource {
  policyFileId: number;
  bankId: number;
  bankName?: string;
  bankCode?: string;
  fileName: string;
  chunkIndex: number;
  similarity: number;
  distance?: number;
}

export interface CachedPolicyAnswer {
  answer: string;
  sources: CachedPolicySource[];
  retrievedChunks: number;
  cachedAt: number;
}

class PolicySemanticCache {
  private cache = new Map<string, CachedPolicyAnswer>();
  private readonly ttlMs: number;
  private readonly maxEntries: number;

  constructor(ttlMs = 3600 * 1000, maxEntries = 500) {
    this.ttlMs = ttlMs;
    this.maxEntries = maxEntries;
  }

  /**
   * Normalizes query into a canonical intent key.
   * Strips punctuation, filler words, and extra whitespace.
   */
  public generateKey(bankIdentifier: string | number, rawQuery: string): string {
    const normalizedBank = String(bankIdentifier).toLowerCase().replace(/[^a-z0-9]/g, "");
    const normalizedQuery = rawQuery
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(
        (w) =>
          w.length > 0 &&
          !["what", "is", "the", "for", "in", "of", "a", "an", "tell", "me", "about", "give", "please", "can", "i", "get"].includes(w)
      )
      .sort()
      .join("_");

    return `${normalizedBank}::${normalizedQuery}`;
  }

  public get(bankIdentifier: string | number, rawQuery: string): CachedPolicyAnswer | null {
    const key = this.generateKey(bankIdentifier, rawQuery);
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Invalidate and purge poisoned negative refusal entries
    if (
      entry.answer &&
      (entry.answer.includes("The retrieved policy evidence does not specify this requirement.") ||
        (entry.answer.includes("Not specified in the available policy.") && entry.answer.length < 200))
    ) {
      this.cache.delete(key);
      return null;
    }

    // Check expiration
    if (Date.now() - entry.cachedAt > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  public set(
    bankIdentifier: string | number,
    rawQuery: string,
    data: Omit<CachedPolicyAnswer, "cachedAt">
  ): void {
    // NEVER cache negative refusal responses to avoid cache poisoning!
    if (
      !data.answer ||
      data.answer.includes("The retrieved policy evidence does not specify this requirement.") ||
      (data.answer.includes("Not specified in the available policy.") && data.answer.length < 200)
    ) {
      return;
    }

    const key = this.generateKey(bankIdentifier, rawQuery);

    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      ...data,
      cachedAt: Date.now(),
    });
  }

  public clear(): void {
    this.cache.clear();
  }

  public size(): number {
    return this.cache.size;
  }
}

export const policyCache = new PolicySemanticCache();
