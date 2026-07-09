// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';

/**
 * Owns invalidation of the three Zerion-backed portfolio caches for a Safe:
 * wallet-portfolio (`/v2/safes` overview), the portfolio route, and positions.
 *
 * All three serve views of the same Zerion aggregation, so a state change for
 * the Safe (an on-chain event, or a manual refresh) must clear them together —
 * clearing only one would leave the others serving the stale snapshot until
 * their TTLs expire.
 */
@Injectable()
export class ZerionCacheService {
  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {}

  /**
   * Clears every Zerion-backed cache for the Safe.
   *
   * @param address - The Safe address whose caches to clear.
   * @param source - What triggered the invalidation, for observability: the
   * on-chain event type (e.g. `INCOMING_TOKEN`) or `refresh`.
   */
  async invalidate(address: Address, source: string): Promise<void> {
    this.loggingService.debug({
      type: LogType.PortfolioCacheInvalidated,
      address,
      source,
    });
    await Promise.all([
      this.cacheService.deleteByKey(
        CacheRouter.getZerionWalletPortfolioCacheKey({ address }),
      ),
      this.cacheService.deleteByKey(
        CacheRouter.getPortfolioCacheKey({ address }),
      ),
      this.cacheService.deleteByKey(
        CacheRouter.getZerionPositionsCacheKey({ safeAddress: address }),
      ),
    ]);
  }
}
