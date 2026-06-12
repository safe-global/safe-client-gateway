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

  incrementBy(
    cacheKey: string,
    amount: number,
    expireTimeSeconds: number | undefined,
    expireDeviatePercent?: number,
  ): Promise<number>;

  setCounter(
    key: string,
    value: number,
    expireTimeSeconds: number | undefined,
    expireDeviatePercent?: number,
  ): Promise<void>;
}
