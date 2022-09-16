import { ICacheService } from '../cache.service.interface';

export class FakeCacheService implements ICacheService {
  private cache: Record<string, Record<string, any>> = {};

  keyCount(): number {
    return Object.keys(this.cache).length;
  }

  clear() {
    this.cache = {};
  }

  delete(key: string) {
    delete this.cache[key];
  }

  get(key: string, field: string): Promise<string | undefined> {
    const fields = this.cache[key];
    if (fields === undefined) return Promise.resolve(undefined);
    return Promise.resolve(this.cache[key][field]);
  }

  set(
    key: string,
    field: string,
    value: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    expireTimeSeconds?: number,
  ): Promise<void> {
    const fields = this.cache[key];
    if (fields === undefined) {
      this.cache[key] = {};
    }
    this.cache[key][field] = value;
    return Promise.resolve();
  }
}
