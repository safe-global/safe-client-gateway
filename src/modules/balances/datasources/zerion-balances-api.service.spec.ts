// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { HttpStatus } from '@nestjs/common';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { LimitReachedError } from '@/datasources/network/entities/errors/limit-reached.error';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { HttpExceptionNoLog } from '@/domain/common/errors/http-exception-no-log.error';
import type { ILoggingService } from '@/logging/logging.interface';
import { ZerionBalancesApi } from '@/modules/balances/datasources/zerion-balances-api.service';
import { balancesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/balances-provider.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { ZerionRateLimiter } from '@/modules/zerion/datasources/zerion-rate-limiter.service';
import { rawify } from '@/validation/entities/raw.entity';

const mockCacheService = vi.mocked({
  increment: vi.fn(),
  hGet: vi.fn(),
  hSet: vi.fn(),
} as MockedObject<ICacheService>);

const mockLoggingService = {
  debug: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

const mockNetworkService = vi.mocked({
  get: vi.fn(),
} as MockedObject<INetworkService>);

const mockHttpErrorFactory = vi.mocked({
  from: vi.fn(),
} as MockedObject<HttpErrorFactory>);

const mockZerionRateLimiter = vi.mocked({
  assertWithinBudget: vi.fn(),
} as unknown as MockedObject<ZerionRateLimiter>);

describe('ZerionBalancesApiService', () => {
  let service: ZerionBalancesApi;
  let fakeConfigurationService: FakeConfigurationService;
  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const defaultExpirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();
  const supportedFiatCodes = Array.from(
    new Set([
      ...faker.helpers.multiple(() => faker.finance.currencyCode(), {
        count: { min: 2, max: 5 },
      }),
    ]),
  );

  beforeEach(() => {
    vi.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.zerion.apiKey',
      zerionApiKey,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.baseUri',
      zerionBaseUri,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      defaultExpirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.currencies',
      supportedFiatCodes,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.limitPeriodSeconds',
      faker.number.int(),
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.limitCalls',
      faker.number.int(),
    );

    service = new ZerionBalancesApi(
      mockCacheService,
      mockLoggingService,
      mockNetworkService,
      fakeConfigurationService,
      mockHttpErrorFactory,
      mockZerionRateLimiter,
    );
  });

  describe('getBalances', () => {
    it('should fail for an invalid fiatCode', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.string.alphanumeric({
        exclude: supportedFiatCodes,
      });

      await expect(
        service.getBalances({
          chain,
          safeAddress,
          fiatCode,
        }),
      ).rejects.toThrow(`Unsupported currency code: ${fiatCode}`);
    });

    it('should not hit the network and rethrow when over the Zerion budget', async () => {
      const chain = chainBuilder().with('isTestnet', false).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockCacheService.hGet.mockResolvedValue(null);
      mockZerionRateLimiter.assertWithinBudget.mockRejectedValue(
        new LimitReachedError(),
      );

      await expect(
        service.getBalances({ chain, safeAddress, fiatCode }),
      ).rejects.toThrow(LimitReachedError);
      expect(mockZerionRateLimiter.assertWithinBudget).toHaveBeenCalledWith({
        datasource: 'balances',
      });
      expect(mockNetworkService.get).not.toHaveBeenCalled();
    });

    it('should get the chainName from the chain parameter', async () => {
      const chain = chainBuilder().with('isTestnet', false).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [] }),
        status: 200,
      });

      await service.getBalances({
        chain,
        safeAddress,
        fiatCode,
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        networkRequest: {
          headers: {
            Authorization: `Basic ${zerionApiKey}`,
          },
          params: {
            'filter[chain_ids]': chain.balancesProvider.chainName,
            currency: fiatCode.toLowerCase(),
            sort: 'value',
          },
        },
      });
    });

    it('should include X-Env header for testnet chains', async () => {
      const chain = chainBuilder().with('isTestnet', true).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [] }),
        status: 200,
      });

      await service.getBalances({
        chain,
        safeAddress,
        fiatCode,
      });

      expect(mockNetworkService.get).toHaveBeenCalledWith({
        url: `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        networkRequest: {
          headers: {
            Authorization: `Basic ${zerionApiKey}`,
            'X-Env': 'testnet',
          },
          params: {
            'filter[chain_ids]': chain.balancesProvider.chainName,
            currency: fiatCode.toLowerCase(),
            sort: 'value',
          },
        },
      });
    });

    it('should throw an error when chain is not supported and dynamic fetching returns no match', async () => {
      const unsupportedChainId = '999999';
      const chain = chainBuilder()
        .with('chainId', unsupportedChainId)
        .with('isTestnet', false)
        .with(
          'balancesProvider',
          balancesProviderBuilder().with('chainName', null).build(),
        )
        .build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);

      // Mock Zerion chains API to return empty results (chain not supported)
      mockNetworkService.get
        .mockResolvedValueOnce({
          data: rawify({ data: [] }),
          status: 200,
        })
        .mockResolvedValueOnce({
          data: rawify({ data: [] }),
          status: 200,
        });

      const message = `Chain ${unsupportedChainId} balances retrieval via Zerion is not configured`;
      await expect(
        service.getBalances({
          chain,
          safeAddress,
          fiatCode,
        }),
      ).rejects.toThrow(
        new HttpExceptionNoLog(message, HttpStatus.UNPROCESSABLE_ENTITY),
      );
      // Logged as warning so it does not trigger error alerts for
      // networks that Zerion does not support.
      expect(mockLoggingService.warn).toHaveBeenCalledWith(message);
    });
  });

  describe('getCollectibles', () => {
    it('rethrows LimitReachedError (not a wrapped 5xx) when over budget', async () => {
      const chain = chainBuilder().with('isTestnet', false).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      mockCacheService.hGet.mockResolvedValue(null);
      mockZerionRateLimiter.assertWithinBudget.mockRejectedValue(
        new LimitReachedError(),
      );

      await expect(
        service.getCollectibles({ chain, safeAddress }),
      ).rejects.toThrow(LimitReachedError);
      expect(mockZerionRateLimiter.assertWithinBudget).toHaveBeenCalledWith({
        datasource: 'collectibles',
      });
      expect(mockNetworkService.get).not.toHaveBeenCalled();
      // The error must not be re-wrapped by the HTTP error factory.
      expect(mockHttpErrorFactory.from).not.toHaveBeenCalled();
    });
  });
});
