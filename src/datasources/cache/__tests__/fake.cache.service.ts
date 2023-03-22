import { ICacheService } from '../cache.service.interface';
import { CacheDir } from '../entities/cache-dir.entity';

export class FakeCacheService implements ICacheService {
  private cache: Record<string, Record<string, any>> = {};

  keyCount(): number {
    return Object.keys(this.cache).length;
  }

  clear() {
    this.cache = {};
  }

  delete(cacheDir: CacheDir): Promise<number> {
    delete this.cache[cacheDir.key];
    return Promise.resolve(1);
  }

  deleteByPattern(pattern: string): Promise<void> {
    this.cache = Object.entries(this.cache)
      .filter(([k]) => !RegExp(pattern.replace('*', '.*')).test(k))
      .reduce((res, i) => ({ ...res, ...{ [i[0]]: i[1] } }), {});
    return Promise.resolve();
  }

  get(cacheDir: CacheDir): Promise<string | undefined> {
    const fields = this.cache[cacheDir.key];
    if (fields === undefined) return Promise.resolve(undefined);
    return Promise.resolve(this.cache[cacheDir.key][cacheDir.field]);
  }

  set(
    cacheDir: CacheDir,
    value: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expireTimeSeconds?: number,
  ): Promise<void> {
    const fields = this.cache[cacheDir.key];
    if (fields === undefined) {
      this.cache[cacheDir.key] = {};
    }
    this.cache[cacheDir.key][cacheDir.field] = value;
    return Promise.resolve();
  }
}
