import { ICacheService } from '../cache.service.interface';

export class FakeCacheService implements ICacheService {
  private cache: Record<string, any> = {};

  keyCount(): number {
    return Object.keys(this.cache).length;
  }

  clear() {
    this.cache = {};
  }

  delete(key: string) {
    delete this.cache[key];
  }

  get<T>(key: string): Promise<T> {
    return Promise.resolve(this.cache[key]);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  set(key: string, value: string, expireTimeSeconds: number): Promise<void> {
    this.cache[key] = value;
    return Promise.resolve();
  }
}
