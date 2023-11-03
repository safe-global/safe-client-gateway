import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  set(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds?: number,
  ): Promise<void>;

  get(cacheDir: CacheDir): Promise<string | undefined>;

  deleteByKey(key: string): Promise<number>;

  deleteByKeyPattern(pattern: string): Promise<void>;

  expire(key: string, expireTimeSeconds: number);
}
