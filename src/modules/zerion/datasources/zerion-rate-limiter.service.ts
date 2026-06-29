// SPDX-License-Identifier: FSL-1.1-MIT
import { Inject, Injectable } from '@nestjs/common';
import type { Address } from 'viem';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheRouter } from '@/datasources/cache/cache.router';
import {
  CacheService,
  type ICacheService,
} from '@/datasources/cache/cache.service.interface';
import { LimitReachedError } from '@/datasources/network/entities/errors/limit-reached.error';
import { LogType } from '@/domain/common/entities/log-type.entity';
import {
  type ILoggingService,
  LoggingService,
} from '@/logging/logging.interface';
import { asError } from '@/logging/utils';

type RateLimitScope = 'global' | 'per_address';

/**
 * Cross-pod rate limiter for the shared Zerion API account budget.
 *
 * Zerion enforces an account-wide ceiling (~10 RPS), shared by every CGW pod
 * and every Zerion datasource (balances, positions, wallet portfolio…). This
 * limiter increments a single Redis fixed-window counter so the cluster stays
 * under that ceiling, with an optional per-address sub-budget that prevents one
 * hot wallet from starving the global budget.
 *
 * On over-budget it throws {@link LimitReachedError}; callers decide whether to
 * surface it (a 429) or degrade gracefully. It fails open on Redis errors — a
 * Redis blip must not block the Zerion path.
 */
@Injectable()
export class ZerionRateLimiter {
  private static readonly GLOBAL_KEY_PREFIX = 'zerion';
  private readonly limitCalls: number;
  private readonly limitPeriodSeconds: number;
  private readonly perAddressCalls: number;
  private readonly perAddressPeriodSeconds: number;

  constructor(
    @Inject(CacheService) private readonly cacheService: ICacheService,
    @Inject(IConfigurationService)
    configurationService: IConfigurationService,
    @Inject(LoggingService) private readonly loggingService: ILoggingService,
  ) {
    this.limitCalls = configurationService.getOrThrow<number>(
      'balances.providers.zerion.limitCalls',
    );
    this.limitPeriodSeconds = configurationService.getOrThrow<number>(
      'balances.providers.zerion.limitPeriodSeconds',
    );
    this.perAddressCalls = configurationService.getOrThrow<number>(
      'balances.providers.zerion.perAddressLimitCalls',
    );
    this.perAddressPeriodSeconds = configurationService.getOrThrow<number>(
      'balances.providers.zerion.perAddressLimitPeriodSeconds',
    );
  }

  /**
   * Enforces the shared Zerion budget before a network call.
   *
   * The per-address sub-budget is checked first so a hot wallet trips its own
   * limit before consuming any of the global budget. A tier whose configured
   * limit is non-positive is treated as disabled.
   *
   * @param args.datasource - Caller label, used for observability.
   * @param args.address - When provided, also enforces the per-address budget.
   * @throws {LimitReachedError} When either budget is exceeded.
   */
  async assertWithinBudget(args: {
    datasource: string;
    address?: Address;
  }): Promise<void> {
    if (args.address && this.perAddressCalls > 0) {
      const perAddress = await this._increment(
        CacheRouter.getRateLimitCacheKey(
          `${ZerionRateLimiter.GLOBAL_KEY_PREFIX}_${args.address}`,
        ),
        this.perAddressPeriodSeconds,
      );
      if (perAddress !== null && perAddress > this.perAddressCalls) {
        this._logRateLimited({
          datasource: args.datasource,
          scope: 'per_address',
        });
        throw new LimitReachedError();
      }
    }

    if (this.limitCalls > 0) {
      const global = await this._increment(
        CacheRouter.getRateLimitCacheKey(ZerionRateLimiter.GLOBAL_KEY_PREFIX),
        this.limitPeriodSeconds,
      );
      if (global !== null && global > this.limitCalls) {
        this._logRateLimited({ datasource: args.datasource, scope: 'global' });
        throw new LimitReachedError();
      }
    }
  }

  /**
   * Increments a fixed-window counter, failing open (returns null) on a Redis
   * error or non-finite value so the Zerion path is never blocked by the cache.
   */
  private async _increment(
    key: string,
    periodSeconds: number,
  ): Promise<number | null> {
    try {
      const count = await this.cacheService.increment(key, periodSeconds, 0);
      return Number.isFinite(count) ? count : null;
    } catch (error) {
      this.loggingService.warn(
        `Zerion rate-limit check failed open: ${asError(error)}`,
      );
      return null;
    }
  }

  private _logRateLimited(args: {
    datasource: string;
    scope: RateLimitScope;
  }): void {
    this.loggingService.warn({
      type: LogType.RateLimit,
      source: 'ZerionRateLimiter',
      datasource: args.datasource,
      scope: args.scope,
      event: 'Zerion account budget exceeded',
    });
  }
}
