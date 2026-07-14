// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { ZodError } from 'zod';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { LimitReachedError } from '@/datasources/network/entities/errors/limit-reached.error';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { ZerionWalletPortfolioApi } from '@/modules/balances/datasources/zerion-wallet-portfolio-api.service';
import type { ZerionRateLimiter } from '@/modules/zerion/datasources/zerion-rate-limiter.service';

const mockNetworkService = vi.mocked({
  get: vi.fn(),
} as MockedObject<INetworkService>);

const mockCacheService = vi.mocked({
  hGet: vi.fn(),
  hSet: vi.fn(),
} as MockedObject<ICacheService>);

const mockLoggingService = {
  debug: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
} as MockedObject<ILoggingService>;

const mockHttpErrorFactory = vi.mocked({
  from: vi.fn(),
} as MockedObject<HttpErrorFactory>);

const mockZerionRateLimiter = vi.mocked({
  assertWithinBudget: vi.fn(),
} as unknown as MockedObject<ZerionRateLimiter>);

const buildPortfolioResponse = (
  byChain: Record<string, number>,
): { data: unknown } => ({
  data: {
    type: 'portfolio',
    id: faker.string.uuid(),
    attributes: {
      total: { positions: Object.values(byChain).reduce((a, b) => a + b, 0) },
      positions_distribution_by_chain: byChain,
    },
  },
});

describe('ZerionWalletPortfolioApi', () => {
  let service: ZerionWalletPortfolioApi;
  let fakeConfigurationService: FakeConfigurationService;
  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });
  const address = getAddress(faker.finance.ethereumAddress());

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
      'balances.providers.zerion.walletPortfolioTtlSeconds',
      10,
    );

    service = new ZerionWalletPortfolioApi(
      fakeConfigurationService,
      mockNetworkService,
      mockHttpErrorFactory,
      mockCacheService,
      mockLoggingService,
      mockZerionRateLimiter,
    );
  });

  it('returns the cached portfolio without a network call or budget check', async () => {
    const cached = buildPortfolioResponse({ ethereum: 100 });
    mockCacheService.hGet.mockResolvedValue(JSON.stringify(cached));

    const result = await service.getPortfolio({
      address,
      currency: 'usd',
      isTestnet: false,
    });

    expect(
      result.data.attributes.positions_distribution_by_chain.ethereum,
    ).toBe(100);
    expect(mockZerionRateLimiter.assertWithinBudget).not.toHaveBeenCalled();
    expect(mockNetworkService.get).not.toHaveBeenCalled();
  });

  it('fetches, validates, and caches on a cache miss', async () => {
    const response = buildPortfolioResponse({ ethereum: 42, polygon: 8 });
    mockCacheService.hGet.mockResolvedValue(null);
    mockNetworkService.get.mockResolvedValue({ data: response, status: 200 });

    const result = await service.getPortfolio({
      address,
      currency: 'usd',
      isTestnet: false,
    });

    expect(mockZerionRateLimiter.assertWithinBudget).toHaveBeenCalledWith({
      datasource: 'wallet_portfolio',
      address,
    });
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${zerionBaseUri}/v1/wallets/${address}/portfolio`,
      networkRequest: {
        headers: { Authorization: `Basic ${zerionApiKey}` },
        params: { currency: 'usd', 'filter[positions]': 'no_filter' },
      },
    });
    expect(mockCacheService.hSet).toHaveBeenCalled();
    expect(result.data.attributes.positions_distribution_by_chain).toEqual({
      ethereum: 42,
      polygon: 8,
    });
  });

  it('does not hit the network when over budget (degrade upstream)', async () => {
    mockCacheService.hGet.mockResolvedValue(null);
    mockZerionRateLimiter.assertWithinBudget.mockRejectedValue(
      new LimitReachedError(),
    );

    await expect(
      service.getPortfolio({ address, currency: 'usd', isTestnet: false }),
    ).rejects.toThrow(LimitReachedError);
    expect(mockNetworkService.get).not.toHaveBeenCalled();
    expect(mockCacheService.hSet).not.toHaveBeenCalled();
  });

  it('throws ZodError on a malformed fresh 200 (never cached)', async () => {
    mockCacheService.hGet.mockResolvedValue(null);
    mockNetworkService.get.mockResolvedValue({
      data: { data: { type: 'portfolio' } },
      status: 200,
    });

    await expect(
      service.getPortfolio({ address, currency: 'usd', isTestnet: false }),
    ).rejects.toThrow(ZodError);
    expect(mockCacheService.hSet).not.toHaveBeenCalled();
  });

  it('sends the testnet header and trash filter for testnet + trusted', async () => {
    mockCacheService.hGet.mockResolvedValue(null);
    mockNetworkService.get.mockResolvedValue({
      data: buildPortfolioResponse({ ethereum: 1 }),
      status: 200,
    });

    await service.getPortfolio({
      address,
      currency: 'eur',
      isTestnet: true,
      trusted: true,
    });

    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${zerionBaseUri}/v1/wallets/${address}/portfolio`,
      networkRequest: {
        headers: { Authorization: `Basic ${zerionApiKey}`, 'X-Env': 'testnet' },
        params: {
          currency: 'eur',
          'filter[positions]': 'no_filter',
          'filter[trash]': 'only_non_trash',
        },
      },
    });
  });

  it('keys the cache distinctly by testnet and trusted', () => {
    const mainnet = CacheRouter.getZerionWalletPortfolioCacheDir({
      address,
      fiatCode: 'usd',
      isTestnet: false,
    });
    const testnet = CacheRouter.getZerionWalletPortfolioCacheDir({
      address,
      fiatCode: 'usd',
      isTestnet: true,
    });
    const trusted = CacheRouter.getZerionWalletPortfolioCacheDir({
      address,
      fiatCode: 'usd',
      trusted: true,
    });

    expect(mainnet.field).not.toBe(testnet.field);
    expect(mainnet.field).not.toBe(trusted.field);
  });
});
