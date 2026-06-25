// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { ZerionWalletPortfolio } from '@/modules/balances/datasources/entities/zerion-wallet-portfolio.entity';
import { ZerionWalletPortfolioApi } from '@/modules/balances/datasources/zerion-wallet-portfolio-api.service';

describe('ZerionWalletPortfolioApi', () => {
  let service: ZerionWalletPortfolioApi;
  let fakeConfigurationService: FakeConfigurationService;

  const zerionApiKey = faker.string.sample();
  const zerionBaseUri = faker.internet.url({ appendSlash: false });

  const mockNetworkService = vi.mocked({
    get: vi.fn(),
  } as MockedObject<INetworkService>);

  const mockHttpErrorFactory = vi.mocked({
    from: vi.fn(),
  } as MockedObject<HttpErrorFactory>);

  const mockCacheService = vi.mocked({
    hGet: vi.fn(),
    hSet: vi.fn(),
  } as MockedObject<ICacheService>);

  const mockLoggingService = vi.mocked({
    debug: vi.fn(),
  } as MockedObject<ILoggingService>);

  const portfolio = (): ZerionWalletPortfolio => ({
    data: {
      type: 'portfolio',
      id: faker.string.uuid(),
      attributes: {
        total: { positions: faker.number.float() },
        positions_distribution_by_chain: { ethereum: faker.number.float() },
      },
    },
  });

  const args = (): {
    address: `0x${string}`;
    currency: string;
    isTestnet: boolean;
  } => ({
    address: getAddress(faker.finance.ethereumAddress()),
    currency: 'USD',
    isTestnet: false,
  });

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

    service = new ZerionWalletPortfolioApi(
      fakeConfigurationService as IConfigurationService,
      mockNetworkService,
      mockHttpErrorFactory,
      mockCacheService,
      mockLoggingService,
    );
  });

  it('returns the cached portfolio without calling the network', async () => {
    const data = portfolio();
    mockCacheService.hGet.mockResolvedValue(JSON.stringify(data));

    const result = await service.getPortfolio(args());

    expect(result).toStrictEqual(data);
    expect(mockNetworkService.get).not.toHaveBeenCalled();
  });

  it('fetches and caches the portfolio on a cache miss', async () => {
    const data = portfolio();
    mockCacheService.hGet.mockResolvedValue(null);
    mockNetworkService.get.mockResolvedValue({ status: 200, data } as never);

    const result = await service.getPortfolio(args());

    expect(result).toStrictEqual(data);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent identical fetches on a cold cache into one request', async () => {
    const data = portfolio();
    mockCacheService.hGet.mockResolvedValue(null);
    let resolveGet: (value: unknown) => void = () => {};
    mockNetworkService.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveGet = resolve;
      }) as never,
    );
    const sharedArgs = args();

    const [first, second] = [
      service.getPortfolio(sharedArgs),
      service.getPortfolio(sharedArgs),
    ];
    resolveGet({ status: 200, data });
    const [firstResult, secondResult] = await Promise.all([first, second]);

    expect(firstResult).toStrictEqual(data);
    expect(secondResult).toStrictEqual(data);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
  });

  it('evicts the in-flight entry when the fetch rejects so the next caller retries', async () => {
    const data = portfolio();
    mockCacheService.hGet.mockResolvedValue(null);
    mockHttpErrorFactory.from.mockReturnValue(new Error('Zerion error'));
    mockNetworkService.get
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ status: 200, data } as never);
    const sharedArgs = args();

    await expect(service.getPortfolio(sharedArgs)).rejects.toThrow();
    const result = await service.getPortfolio(sharedArgs);

    expect(result).toStrictEqual(data);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(2);
  });
});
