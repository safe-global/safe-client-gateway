import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { ICacheReadiness } from '@/domain/interfaces/cache-readiness.interface';

export class FakeCacheService implements ICacheService, ICacheReadiness {
  private cache: Record<string, Record<string, string> | number> = {};
  private isReady: boolean = true;

  ping(): Promise<unknown> {
    return this.isReady ? Promise.resolve() : Promise.reject();
  }

  setReadyState(isReady: boolean): void {
    this.isReady = isReady;
  }

  keyCount(): number {
    return Object.keys(this.cache).length;
  }

  clear(): void {
    this.cache = {};
  }

  async deleteByKey(key: string): Promise<number> {
    delete this.cache[key];
    await this.set(
      new CacheDir(`invalidationTimeMs:${key}`, ''),
      Date.now().toString(),
      1, // non-falsy expireTimeSeconds, otherwise it wouldn't be written
    );
    return Promise.resolve(1);
  }

  get(cacheDir: CacheDir): Promise<string | undefined> {
    const fields = this.cache[cacheDir.key];
    if (fields === undefined) return Promise.resolve(undefined);
    return Promise.resolve(
      (this.cache[cacheDir.key] as Record<string, string>)[cacheDir.field],
    );
  }

  set(
    cacheDir: CacheDir,
    value: string | number,
    expireTimeSeconds: number | undefined,
  ): Promise<void> {
    if (!expireTimeSeconds || expireTimeSeconds <= 0) {
      return Promise.resolve();
    }
    if (typeof value === 'number') {
      this.cache[cacheDir.key] = value;
      return Promise.resolve();
    }
    const fields = this.cache[cacheDir.key];
    if (fields === undefined) {
      this.cache[cacheDir.key] = {};
    }
    (this.cache[cacheDir.key] as Record<string, string>)[cacheDir.field] =
      value;
    return Promise.resolve();
  }

  increment(
    cacheKey: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expireTimeSeconds: number | undefined,
  ): Promise<number> {
    let currentValue: number = this.cache[cacheKey] as number;
    currentValue = currentValue ? currentValue + 1 : 1;
    this.cache[cacheKey] = currentValue;
    return Promise.resolve(currentValue);
  }
}
