// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { errorStatusCodeExcluding } from '@/__tests__/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import {
  UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
  UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
} from '@/datasources/errors/constants';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { NetworkResponseError } from '@/datasources/network/entities/network.error.entity';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { DataSourceError } from '@/domain/errors/data-source.error';
import type { IPricesApi } from '@/modules/balances/datasources/prices-api.interface';
import { SafeBalancesApi } from '@/modules/balances/datasources/safe-balances-api.service';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';

const mockDataSource = vi.mocked({
  get: vi.fn(),
} as MockedObject<CacheFirstDataSource>);

const mockCacheService = vi.mocked({
  deleteByKey: vi.fn(),
} as unknown as MockedObject<ICacheService>);

const mockCoingeckoApi = vi.mocked({
  getNativeCoinPrice: vi.fn(),
  getTokenPrices: vi.fn(),
} as unknown as MockedObject<IPricesApi>);

const mockNetworkService = vi.mocked({
  get: vi.fn(),
} as MockedObject<INetworkService>);

describe('SafeBalancesApi banned-Safe error funnel', () => {
  let service: SafeBalancesApi;
  const chainId = faker.string.numeric();
  const baseUrl = faker.internet.url({ appendSlash: false });

  beforeEach(() => {
    vi.resetAllMocks();

    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('application.isProduction', true);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      faker.number.int(),
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      faker.number.int(),
    );

    service = new SafeBalancesApi(
      chainId,
      baseUrl,
      mockDataSource,
      mockCacheService,
      fakeConfigurationService,
      new HttpErrorFactory(),
      mockCoingeckoApi,
      mockNetworkService,
    );
  });

  describe.each([
    {
      name: 'getBalances',
      upstream: (): typeof mockDataSource.get => mockDataSource.get,
      call: (): Promise<unknown> =>
        service.getBalances({
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          fiatCode: faker.finance.currencyCode(),
          chain: chainBuilder().with('chainId', chainId).build(),
        }),
    } as const,
    {
      // Bypasses the cache and calls the network service directly: the no-fee
      // relayer validation path is its only caller, so no route reaches it
      name: 'getBalance',
      upstream: (): typeof mockNetworkService.get => mockNetworkService.get,
      call: (): Promise<unknown> =>
        service.getBalance({
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          fiatCode: faker.finance.currencyCode(),
          chain: chainBuilder().with('chainId', chainId).build(),
          tokenAddress: getAddress(faker.finance.ethereumAddress()),
        }),
    } as const,
    {
      name: 'getCollectibles',
      upstream: (): typeof mockDataSource.get => mockDataSource.get,
      call: (): Promise<unknown> =>
        service.getCollectibles({
          safeAddress: getAddress(faker.finance.ethereumAddress()),
        }),
    } as const,
  ])('$name', ({ upstream, call }) => {
    it('maps a banned-Safe response to a 451 with a dedicated message', async () => {
      upstream().mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(baseUrl),
          {
            status: UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
          } as Response,
          // The Transaction Service reports the reason under `detail`, a key
          // HttpErrorFactory does not read; the text itself is discarded
          { detail: faker.word.words() },
        ),
      );

      await expect(call()).rejects.toThrow(
        new DataSourceError(
          UNAVAILABLE_FOR_LEGAL_REASONS_MESSAGE,
          UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
        ),
      );
    });

    it('forwards the upstream message for any other error status', async () => {
      const statusCode = errorStatusCodeExcluding(
        UNAVAILABLE_FOR_LEGAL_REASONS_STATUS,
      );
      const message = faker.word.words();
      upstream().mockRejectedValueOnce(
        new NetworkResponseError(
          new URL(baseUrl),
          { status: statusCode } as Response,
          { message },
        ),
      );

      await expect(call()).rejects.toThrow(
        new DataSourceError(message, statusCode),
      );
    });
  });
});
