// SPDX-License-Identifier: FSL-1.1-MIT
import type { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';

export const CacheService = Symbol('ICacheService');

export interface ICacheService {
  getCounter(key: string): Promise<number | null>;

  hSet(
    cacheDir: CacheDir,
    value: string,
    expireTimeSeconds: number | undefined,
    expireDeviatePercent?: number,
  ): Promise<void>;

  hGet(cacheDir: CacheDir): Promise<string | null>;

  deleteByKey(key: string): Promise<number>;

  increment(
    cacheKey: string,
    expireTimeSeconds: number | undefined,
    expireDeviatePercent?: number,
  ): Promise<number>;

  /**
   * Atomically increments a counter and sets its TTL on first creation.
   *
   * Unlike {@link increment} (which relies on `EXPIRE … NX`, a Redis 7.0+
   * feature), this uses a Lua `INCR`+`EXPIRE` script that works on Redis 6 and
   * 7 alike. Use this for fixed-window rate limiting so the window reliably
   * resets regardless of the deployed Redis version.
   *
   * @param cacheKey - Counter key (not prefixed, matching {@link increment}).
   * @param ttlSeconds - Window length in seconds, applied on first increment.
   * @returns The counter value after incrementing.
   */
  incrWithTtl(cacheKey: string, ttlSeconds: number): Promise<number>;

  setCounter(
    key: string,
    value: number,
    expireTimeSeconds: number | undefined,
    expireDeviatePercent?: number,
  ): Promise<void>;
}
