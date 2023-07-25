import { Inject, Injectable } from '@nestjs/common';
import { CacheDir } from '../cache/entities/cache-dir.entity';

@Injectable()
export class PromiseRegistry<K extends keyof any> {
  constructor(
    @Inject('Registry') private readonly registry: Record<K, Promise<unknown>>,
  ) {}

  /**
   * Registers a function to be executed with a key. If there's a matching execution,
   * that promise is returned.
   *
   * If there is no match, the function is registered with the provided key.
   *
   * Once the promise is settled, it is removed from the registry.
   *
   * @param cacheDir - the CacheDir used to register the provided promise
   * @param fn - the function to be executed
   */
  async register<V>(cacheDir: CacheDir, fn: () => V): Promise<V> {
    const key = cacheDir.key + cacheDir.field;

    const activePromise = this.registry[key];
    if (activePromise) return activePromise;

    const promise = new Promise<V>(async (resolve, reject) => {
      try {
        const result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        delete this.registry[key];
      }
    });

    this.registry[key] = promise;

    return promise;
  }
}
