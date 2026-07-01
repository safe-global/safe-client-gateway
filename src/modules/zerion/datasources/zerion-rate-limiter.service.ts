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

type RateLimitScope = 'global' | 'overview' | 'per_address';

/**
 * Priority class of a Zerion consumer.
 *
 * - `bulk`: the high-volume Safe-overview / wallet-portfolio path, which
 *   degrades gracefully to the balances repository. It is additionally capped
 *   by a lower sub-budget so it can never consume the whole account budget.
 * - `interactive`: the low-volume, user-facing endpoints (balances,
 *   collectibles, positions, portfolio) that only check the global budget and
 *   are thus guaranteed the headroom the bulk sub-cap reserves for them.
 */
export type ZerionRateLimitPriority = 'bulk' | 'interactive';

/**
 * Cross-pod rate limiter for the shared Zerion API account budget.
 *
 * Zerion enforces an account-wide ceiling (~10 req/s, in discrete 1-second
 * windows), shared by every CGW pod and every Zerion datasource (balances,
 * positions, wallet portfolio…). This limiter increments a shared Redis
 * fixed-window counter so the cluster stays under that ceiling.
 *
 * To stop the high-volume overview traffic from starving the low-volume
 * user-facing endpoints, the `bulk` consumer is additionally capped by
 * `overviewLimitCalls` (< the global `limitCalls`). Because bulk self-caps, it
 * consumes at most `overviewLimitCalls` of the global budget, leaving
 * `limitCalls - overviewLimitCalls` reserved for `interactive` consumers.
 *
 * On over-budget it throws {@link LimitReachedError}; callers decide whether to
 * surface it (a 429) or degrade gracefully. It fails open on Redis errors — a
 * Redis blip must not block the Zerion path.
 */
@Injectable()
export class ZerionRateLimiter {
  private static readonly GLOBAL_KEY_PREFIX = 'zerion';
  private static readonly OVERVIEW_KEY_PREFIX = 'zerion_overview';
  private readonly limitCalls: number;
  private readonly limitPeriodSeconds: number;
  private readonly overviewLimitCalls: number;
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
    this.overviewLimitCalls = configurationService.getOrThrow<number>(
      'balances.providers.zerion.overviewLimitCalls',
    );
    this.perAddressCalls = configurationService.getOrThrow<number>(
      'balances.providers.zerion.perAddressLimitCalls',
    );
    this.perAddressPeriodSeconds = configurationService.getOrThrow<number>(
      'balances.providers.zerion.perAddressLimitPeriodSeconds',
    );

    // Fail fast on a misconfiguration that would silently defeat the
    // reservation: an overview sub-cap at or above the global cap reserves
    // nothing for the interactive endpoints.
    if (this.limitCalls > 0 && this.overviewLimitCalls >= this.limitCalls) {
      throw new Error(
        `Invalid Zerion rate-limit config: overviewLimitCalls (${this.overviewLimitCalls}) must be less than limitCalls (${this.limitCalls}).`,
      );
    }
  }

  /**
   * Enforces the shared Zerion budget before a network call.
   *
   * The per-address sub-budget is checked first so a hot wallet trips its own
   * limit before consuming any budget. `bulk` consumers then check their
   * lower overview sub-budget before the global budget. A tier whose
   * configured limit is non-positive is treated as disabled.
   *
   * @param args.datasource - Caller label, used for observability.
   * @param args.priority - Consumer priority class (default `interactive`).
   * @param args.address - When provided, also enforces the per-address budget.
   * @throws {LimitReachedError} When any applicable budget is exceeded.
   */
  async assertWithinBudget(args: {
    datasource: string;
    priority?: ZerionRateLimitPriority;
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

    if (args.priority === 'bulk' && this.overviewLimitCalls > 0) {
      const overview = await this._increment(
        CacheRouter.getRateLimitCacheKey(ZerionRateLimiter.OVERVIEW_KEY_PREFIX),
        this.limitPeriodSeconds,
      );
      if (overview !== null && overview > this.overviewLimitCalls) {
        this._logRateLimited({
          datasource: args.datasource,
          scope: 'overview',
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
