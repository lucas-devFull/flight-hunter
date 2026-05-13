/** TTLs recomendados (em ms) */
export const CACHE_TTL = {
  latestPrices: 15 * 60_000,    // 15 min
  cheapPrices: 6 * 3_600_000,   // 6h
  calendar: 12 * 3_600_000,     // 12h
  airports: 7 * 86_400_000,     // 7d
  airlines: 7 * 86_400_000,     // 7d
} as const;

/** Gera chave de cache para deduplicação */
export function dealCacheKey(origin: string, destination: string, date: string): string {
  return `deal:${origin}:${destination}:${date}`;
}

export function routeCacheKey(origin: string): string {
  return `routes:${origin}`;
}

export function calendarCacheKey(origin: string, destination: string): string {
  return `calendar:${origin}:${destination}`;
}

/**
 * Cache em memória simples com TTL.
 * Para produção com múltiplos workers, substituir por Redis.
 */
export class MemoryCache<T> {
  private store = new Map<string, { value: T; expiresAt: number }>();

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}
