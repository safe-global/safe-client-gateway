import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import postgres from 'postgres';

export const ICachedQueryResolver = Symbol('ICachedQueryResolver');

export interface ICachedQueryResolver {
  get<T extends postgres.MaybeRow[]>(args: {
    cacheDir: CacheDir;
    query: postgres.PendingQuery<T>;
    ttl: number;
  }): Promise<T>;
}
