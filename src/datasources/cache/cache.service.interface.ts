import { CacheDir } from './entities/cache-dir.entity';

export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  set(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds?: number,
  ): Promise<void>;

  get(cacheDir: CacheDir): Promise<string | undefined>;

  delete(key: string): Promise<number>;
}
