import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  getCounter(key: string): Promise<number | null>;

  hSet(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds: number | undefined,
  ): Promise<void>;

  hGet(cacheDir: CacheDir): Promise<string | undefined>;

  deleteByKey(key: string): Promise<number | undefined>;

  increment(
    cacheKey: string,
    expireTimeSeconds: number | undefined,
  ): Promise<number | undefined>;

  setCounter(
    key: string,
    value: number,
    expireTimeSeconds: number | undefined,
  ): Promise<void>;
}
