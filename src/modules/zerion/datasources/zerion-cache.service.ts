// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '#/config/configuration.service.interface';
import { CacheRouter } from '#/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '#/datasources/cache/cache.service.interface';
import { LogType } from '#/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '#/logging/logging.interface';
import { asError } from '#/logging/utils';
import type { TransactionEventType } from '#/modules/hooks/routes/entities/event-type.entity';

/** What triggered an invalidation: an on-chain event, or a manual refresh. */
export type ZerionCacheInvalidationSource = TransactionEventType | 'refresh';

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
  private readonly settleSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
    @Inject(IConfigurationService) configurationService: IConfigurationService,
  ) {
    this.settleSeconds = configurationService.getOrThrow<number>(
      'portfolio.cache.settleSeconds',
    );
  }

  /**
   * Clears every Zerion-backed cache for the Safe, best-effort: a failed
   * delete is logged but never thrown — neither the event listener nor the
   * refresh caller can act on it, and the entry expires with its TTL anyway.
   *
   * @param address - The Safe address whose caches to clear.
   * @param source - What triggered the invalidation, for observability.
   */
  async invalidate(
    address: Address,
    source: ZerionCacheInvalidationSource,
  ): Promise<void> {
    this.loggingService.debug({
      type: LogType.ZerionCacheInvalidated,
      address,
      source,
    });
    // Recorded before the deletes, so a refetch racing them still sees it.
    await this.recordClearedAt(address, source);
    const keys = [
      CacheRouter.getZerionWalletPortfolioCacheKey({ address }),
      CacheRouter.getPortfolioCacheKey({ address }),
      CacheRouter.getZerionPositionsCacheKey({ safeAddress: address }),
    ];
    const results = await Promise.allSettled(
      keys.map((key) => this.cacheService.deleteByKey(key)),
    );
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        this.loggingService.warn(
          `Zerion cache invalidation failed for ${keys[i]} (source: ${source}): ${asError(result.reason)}`,
        );
      }
    });
  }

  /**
   * Records when the caches were cleared, for the settle window only. Each
   * clear overwrites it and restarts the window. Best-effort, like the deletes.
   *
   * @param address - The Safe address whose caches are cleared.
   * @param source - What triggered the invalidation, for observability.
   */
  private async recordClearedAt(
    address: Address,
    source: ZerionCacheInvalidationSource,
  ): Promise<void> {
    try {
      await this.cacheService.setCounter(
        CacheRouter.getPortfolioClearedAtCacheKey({ address }),
        Date.now(),
        this.settleSeconds,
        0,
      );
    } catch (error) {
      this.loggingService.warn(
        `Zerion cache clear time not recorded for ${address} (source: ${source}): ${asError(error)}`,
      );
    }
  }
}
