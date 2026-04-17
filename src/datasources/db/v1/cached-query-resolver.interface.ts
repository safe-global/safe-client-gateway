import type postgres from 'postgres';
import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export const ICachedQueryResolver = Symbol('ICachedQueryResolver');

export interface ICachedQueryResolver {
  get<T extends Array<postgres.MaybeRow>>(args: {
    cacheDir: CacheDir;
    query: postgres.PendingQuery<T>;
    ttl: number;
  }): Promise<T>;
}
