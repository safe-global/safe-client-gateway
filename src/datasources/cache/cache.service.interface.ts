import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  getCounter(key: string): Promise<number | null>;

  hSet(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds: number | undefined,
    expireDeviatePercent?: number,
  ): Promise<void>;

  hGet(cacheDir: CacheDir): Promise<string | null>;

  /**
   * Gets the remaining TTL in seconds for a cache key.
   * @param {CacheDir} cacheDir - Cache directory
   * @returns {Promise<number | null>} TTL in seconds, TTL_NO_EXPIRY (-1) if no expiry, TTL_KEY_NOT_FOUND (-2) if key doesn't exist, null on error
   * @see TTL_KEY_NOT_FOUND
   * @see TTL_NO_EXPIRY
   */
  getTTL(cacheDir: CacheDir): Promise<number | null>;

  deleteByKey(key: string): Promise<number>;

  increment(
    cacheKey: string,
    expireTimeSeconds: number | undefined,
    expireDeviatePercent?: number,
  ): Promise<number>;

  setCounter(
    key: string,
    value: number,
    expireTimeSeconds: number | undefined,
    expireDeviatePercent?: number,
  ): Promise<void>;
}
