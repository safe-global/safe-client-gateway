import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  set(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds: number | undefined,
  ): Promise<void>;

  get(cacheDir: CacheDir): Promise<string | undefined>;

  deleteByKey(key: string): Promise<number>;
}
