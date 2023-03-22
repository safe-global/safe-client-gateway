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

  delete(key: string): Promise<number> {
    delete this.cache[key];
    return Promise.resolve(1);
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
