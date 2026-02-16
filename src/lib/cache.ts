interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

const memoryCache = new Map<string, CacheItem<unknown>>();

export function getMemoryCache<T>(key: string): T | null {
  const item = memoryCache.get(key);
  if (!item) {
    return null;
  }
  if (Date.now() > item.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return item.value as T;
}

export function setMemoryCache<T>(key: string, value: T, ttlSeconds: number) {
  memoryCache.set(key, {
    value,
    expiresAt: Date.now() + ttlSeconds * 1000
  });
}
