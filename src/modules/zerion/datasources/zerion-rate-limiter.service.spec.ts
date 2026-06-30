// SPDX-License-Identifier: FSL-1.1-MIT

import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { LimitReachedError } from '@/datasources/network/entities/errors/limit-reached.error';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { ILoggingService } from '@/logging/logging.interface';
import { ZerionRateLimiter } from '@/modules/zerion/datasources/zerion-rate-limiter.service';

const mockCacheService = vi.mocked({
  increment: vi.fn(),
} as MockedObject<ICacheService>);

const mockLoggingService = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
} as MockedObject<ILoggingService>;

const GLOBAL_KEY = CacheRouter.getRateLimitCacheKey('zerion');

describe('ZerionRateLimiter', () => {
  let limiter: ZerionRateLimiter;
  let fakeConfigurationService: FakeConfigurationService;
  const limitCalls = 9;
  const limitPeriodSeconds = 1;
  const perAddressCalls = 3;
  const perAddressPeriodSeconds = 10;
  const address = getAddress('0x0000000000000000000000000000000000000001');

  const buildLimiter = (overrides?: {
    limitCalls?: number;
    perAddressCalls?: number;
  }): ZerionRateLimiter => {
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.limitCalls',
      overrides?.limitCalls ?? limitCalls,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.limitPeriodSeconds',
      limitPeriodSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.perAddressLimitCalls',
      overrides?.perAddressCalls ?? perAddressCalls,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.perAddressLimitPeriodSeconds',
      perAddressPeriodSeconds,
    );
    return new ZerionRateLimiter(
      mockCacheService,
      fakeConfigurationService,
      mockLoggingService,
    );
  };

  beforeEach(() => {
    vi.resetAllMocks();
    limiter = buildLimiter();
  });

  it('does not throw when within the global budget', async () => {
    mockCacheService.increment.mockResolvedValue(limitCalls);

    await expect(
      limiter.assertWithinBudget({ datasource: 'balances' }),
    ).resolves.toBeUndefined();
    expect(mockCacheService.increment).toHaveBeenCalledWith(
      GLOBAL_KEY,
      limitPeriodSeconds,
      0,
    );
  });

  it('throws LimitReachedError when over the global budget', async () => {
    mockCacheService.increment.mockResolvedValue(limitCalls + 1);

    await expect(
      limiter.assertWithinBudget({ datasource: 'balances' }),
    ).rejects.toThrow(LimitReachedError);
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      expect.objectContaining({ type: LogType.RateLimit, scope: 'global' }),
    );
  });

  it('does not check the per-address budget when no address is provided', async () => {
    mockCacheService.increment.mockResolvedValue(1);

    await limiter.assertWithinBudget({ datasource: 'balances' });

    expect(mockCacheService.increment).toHaveBeenCalledTimes(1);
    expect(mockCacheService.increment).toHaveBeenCalledWith(
      GLOBAL_KEY,
      limitPeriodSeconds,
      0,
    );
  });

  it('checks the per-address budget before the global budget', async () => {
    // First increment (per-address) trips the limit.
    mockCacheService.increment.mockResolvedValueOnce(perAddressCalls + 1);

    await expect(
      limiter.assertWithinBudget({ datasource: 'wallet_portfolio', address }),
    ).rejects.toThrow(LimitReachedError);

    // Per-address tripped => global budget must NOT be consumed.
    expect(mockCacheService.increment).toHaveBeenCalledTimes(1);
    expect(mockCacheService.increment).toHaveBeenCalledWith(
      CacheRouter.getRateLimitCacheKey(`zerion_${address}`),
      perAddressPeriodSeconds,
      0,
    );
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        type: LogType.RateLimit,
        scope: 'per_address',
      }),
    );
  });

  it('checks per-address then global when per-address is within budget', async () => {
    mockCacheService.increment
      .mockResolvedValueOnce(perAddressCalls) // per-address ok
      .mockResolvedValueOnce(limitCalls); // global ok

    await expect(
      limiter.assertWithinBudget({ datasource: 'wallet_portfolio', address }),
    ).resolves.toBeUndefined();
    expect(mockCacheService.increment).toHaveBeenCalledTimes(2);
  });

  it('skips the per-address tier when its limit is non-positive (disabled)', async () => {
    limiter = buildLimiter({ perAddressCalls: 0 });
    mockCacheService.increment.mockResolvedValue(1);

    await limiter.assertWithinBudget({
      datasource: 'wallet_portfolio',
      address,
    });

    expect(mockCacheService.increment).toHaveBeenCalledTimes(1);
    expect(mockCacheService.increment).toHaveBeenCalledWith(
      GLOBAL_KEY,
      limitPeriodSeconds,
      0,
    );
  });

  it('fails open (does not throw) when the cache errors', async () => {
    mockCacheService.increment.mockRejectedValue(new Error('Redis down'));

    await expect(
      limiter.assertWithinBudget({ datasource: 'balances' }),
    ).resolves.toBeUndefined();
    expect(mockLoggingService.warn).toHaveBeenCalledWith(
      expect.stringContaining('failed open'),
    );
  });

  it('fails open when the counter is non-finite', async () => {
    mockCacheService.increment.mockResolvedValue(Number.NaN);

    await expect(
      limiter.assertWithinBudget({ datasource: 'balances' }),
    ).resolves.toBeUndefined();
  });
});
