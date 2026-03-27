// SPDX-License-Identifier: FSL-1.1-MIT
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { ZerionBalancesApi } from '@/modules/balances/datasources/zerion-balances-api.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { LimitReachedError } from '@/datasources/network/entities/errors/limit-reached.error';
import { balancesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/balances-provider.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { ZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import { ZodError } from 'zod';

const mockCacheService = jest.mocked({
  increment: jest.fn(),
  hGet: jest.fn(),
  hSet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

const mockDataSource = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

const mockHttpErrorFactory = jest.mocked({
  from: jest.fn(),
} as jest.MockedObjectDeep<HttpErrorFactory>);

const mockZerionChainMappingService = jest.mocked({
  getNetworkFromChainId: jest.fn(),
} as jest.MockedObjectDeep<ZerionChainMappingService>);

describe('ZerionBalancesApiService', () => {
  let service: ZerionBalancesApi;
  let fakeConfigurationService: FakeConfigurationService;
  const limitPeriodSeconds = 60;
  const limitCalls = 10;
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
    jest.resetAllMocks();
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
      limitPeriodSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.zerion.limitCalls',
      limitCalls,
    );

    service = new ZerionBalancesApi(
      mockCacheService,
      fakeConfigurationService,
      mockDataSource,
      mockHttpErrorFactory,
      mockZerionChainMappingService,
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

    it('should get the chainName from the chain parameter', async () => {
      const chain = chainBuilder().with('isTestnet', false).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockDataSource.get.mockResolvedValue(rawify({ data: [] }));

      await service.getBalances({
        chain,
        safeAddress,
        fiatCode,
      });

      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: expect.objectContaining({
          key: `zerion_balances_${safeAddress}`,
          field: fiatCode.toUpperCase(),
        }),
        url: `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
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
        expireTimeSeconds: defaultExpirationTimeInSeconds,
      });
    });

    it('should get the chainName from ZerionChainMappingService when chain config is missing', async () => {
      const mappedChainName = faker.word.sample();
      const chain = chainBuilder()
        .with('isTestnet', true)
        .with('chainId', faker.string.numeric())
        .with(
          'balancesProvider',
          balancesProviderBuilder().with('chainName', null).build(),
        )
        .build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockZerionChainMappingService.getNetworkFromChainId.mockResolvedValue(
        mappedChainName,
      );
      mockDataSource.get.mockResolvedValue(rawify({ data: [] }));

      await service.getBalances({
        chain,
        safeAddress,
        fiatCode,
      });

      expect(
        mockZerionChainMappingService.getNetworkFromChainId,
      ).toHaveBeenCalledWith(chain.chainId, chain.isTestnet);
      expect(mockDataSource.get).toHaveBeenCalledWith(
        expect.objectContaining({
          networkRequest: expect.objectContaining({
            params: expect.objectContaining({
              'filter[chain_ids]': mappedChainName,
            }),
          }),
        }),
      );
    });

    it('should include X-Env header for testnet chains', async () => {
      const chain = chainBuilder().with('isTestnet', true).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockDataSource.get.mockResolvedValue(rawify({ data: [] }));

      await service.getBalances({
        chain,
        safeAddress,
        fiatCode,
      });

      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: expect.objectContaining({
          key: `zerion_balances_${safeAddress}`,
          field: fiatCode.toUpperCase(),
        }),
        url: `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
        notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
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
        expireTimeSeconds: defaultExpirationTimeInSeconds,
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

      mockZerionChainMappingService.getNetworkFromChainId.mockResolvedValue(
        undefined,
      );

      await expect(
        service.getBalances({
          chain,
          safeAddress,
          fiatCode,
        }),
      ).rejects.toThrow(
        `Chain ${unsupportedChainId} balances retrieval via Zerion is not configured`,
      );
      expect(mockDataSource.get).not.toHaveBeenCalled();
    });

    it('should throw LimitReachedError when rate limit is exceeded', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockCacheService.increment.mockResolvedValue(limitCalls + 1);

      await expect(
        service.getBalances({
          chain,
          safeAddress,
          fiatCode,
        }),
      ).rejects.toBeInstanceOf(LimitReachedError);
      expect(mockDataSource.get).not.toHaveBeenCalled();
    });

    it('should throw ZodError when balances response shape is invalid', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      mockDataSource.get.mockResolvedValue(rawify({ invalid: true }));

      await expect(
        service.getBalances({
          chain,
          safeAddress,
          fiatCode,
        }),
      ).rejects.toBeInstanceOf(ZodError);
      expect(mockHttpErrorFactory.from).not.toHaveBeenCalled();
    });

    it('should map non-zod errors via HttpErrorFactory', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);
      const sourceError = new Error('source error');
      const mappedError = new Error('mapped error');
      mockDataSource.get.mockRejectedValue(sourceError);
      mockHttpErrorFactory.from.mockReturnValue(mappedError);

      await expect(
        service.getBalances({
          chain,
          safeAddress,
          fiatCode,
        }),
      ).rejects.toThrow(mappedError);
      expect(mockHttpErrorFactory.from).toHaveBeenCalledWith(sourceError);
    });
  });

  describe('getCollectibles', () => {
    it('should include encoded offset when requesting collectibles page', async () => {
      const chain = chainBuilder().with('isTestnet', false).build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const limit = faker.number.int({ min: 1, max: 50 });
      const offset = faker.number.int({ min: 1, max: 500 });
      const expectedPageAfter = Buffer.from(`"${offset}"`, 'utf8').toString(
        'base64',
      );

      mockDataSource.get.mockResolvedValue(
        rawify({
          data: [],
          links: { next: null },
        }),
      );

      await service.getCollectibles({
        chain,
        safeAddress,
        limit,
        offset,
      });

      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: expect.objectContaining({
          key: `zerion_collectibles_${safeAddress}`,
          field: `${limit}_${offset}`,
        }),
        url: `${zerionBaseUri}/v1/wallets/${safeAddress}/nft-positions`,
        notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
        networkRequest: {
          headers: {
            Authorization: `Basic ${zerionApiKey}`,
          },
          params: {
            'filter[chain_ids]': chain.balancesProvider.chainName,
            sort: '-floor_price',
            'page[size]': limit,
            'page[after]': expectedPageAfter,
          },
        },
        expireTimeSeconds: defaultExpirationTimeInSeconds,
      });
    });

    it('should decode Zerion next cursor to offset/limit params', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const encodedOffset = Buffer.from('"0"', 'utf8').toString('base64');

      mockDataSource.get.mockResolvedValue(
        rawify({
          data: [],
          links: {
            next: `${zerionBaseUri}/next?page[size]=10&page[after]=${encodedOffset}`,
          },
        }),
      );

      const result = await service.getCollectibles({
        chain,
        safeAddress,
      });

      const page = result as unknown as { next: string | null };
      expect(page.next).not.toBeNull();
      const decodedUrl = new URL(page.next as string);
      expect(decodedUrl.searchParams.get('limit')).toBe('10');
      expect(decodedUrl.searchParams.get('offset')).toBe('0');
    });

    it('should throw LimitReachedError when rate limit is exceeded', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      mockCacheService.increment.mockResolvedValue(limitCalls + 1);

      await expect(
        service.getCollectibles({
          chain,
          safeAddress,
        }),
      ).rejects.toBeInstanceOf(LimitReachedError);
      expect(mockDataSource.get).not.toHaveBeenCalled();
    });

    it('should throw ZodError when collectibles response shape is invalid', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      mockDataSource.get.mockResolvedValue(rawify({ data: [] }));

      await expect(
        service.getCollectibles({
          chain,
          safeAddress,
        }),
      ).rejects.toBeInstanceOf(ZodError);
      expect(mockHttpErrorFactory.from).not.toHaveBeenCalled();
    });

    it('should map non-zod errors via HttpErrorFactory', async () => {
      const chain = chainBuilder().build();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const sourceError = new Error('source error');
      const mappedError = new Error('mapped error');
      mockDataSource.get.mockRejectedValue(sourceError);
      mockHttpErrorFactory.from.mockReturnValue(mappedError);

      await expect(
        service.getCollectibles({
          chain,
          safeAddress,
        }),
      ).rejects.toThrow(mappedError);
      expect(mockHttpErrorFactory.from).toHaveBeenCalledWith(sourceError);
    });
  });
});
