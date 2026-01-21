import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { Chain } from '@/modules/chains/domain/entities/chain.entity';
import type { ZerionBalance } from '@/modules/balances/datasources/entities/zerion-balance.entity';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { ZerionPositionsApi } from '@/modules/positions/datasources/zerion-positions-api.service';
import type { IZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { balancesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/balances-provider.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const loggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const networkService = {
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;

function buildZerionLoanBalance(args: {
  chainName: string;
  value: number;
}): ZerionBalance {
  return {
    type: 'positions',
    id: faker.string.uuid(),
    attributes: {
      name: faker.word.sample(),
      quantity: {
        int: '1',
        decimals: 18,
        float: 1,
        numeric: '1',
      },
      value: args.value,
      price: 1,
      fungible_info: {
        name: null,
        symbol: null,
        description: null,
        icon: null,
        implementations: [
          {
            chain_id: args.chainName,
            address: null,
            decimals: 18,
          },
        ],
      },
      flags: {
        displayable: true,
      },
      protocol: faker.word.sample(),
      application_metadata: null,
      changes: null,
      position_type: 'loan',
      pool_address: null,
      group_id: null,
    },
  } satisfies ZerionBalance;
}

describe('ZerionPositionsApi', () => {
  describe('Normalization caching tests', () => {
    let cacheService: FakeCacheService;
    let configurationService: FakeConfigurationService;
    let zerionChainMappingService: jest.MockedObjectDeep<IZerionChainMappingService>;
    let target: ZerionPositionsApi;

    const chainName = 'ethereum';
    const chain: Chain = {
      chainId: '1',
      isTestnet: false,
      balancesProvider: { chainName },
    } as Chain;

    beforeEach(() => {
      jest.resetAllMocks();
      cacheService = new FakeCacheService();
      configurationService = new FakeConfigurationService();
      configurationService.set(
        'balances.providers.zerion.apiKey',
        'test-api-key',
      );
      configurationService.set(
        'balances.providers.zerion.baseUri',
        'https://api',
      );
      configurationService.set('expirationTimeInSeconds.zerionPositions', 60);
      configurationService.set('balances.providers.zerion.currencies', ['USD']);
      configurationService.set('balances.providers.zerion.chains', {
        1: { chainName },
      });

      zerionChainMappingService = {
        getChainIdFromNetworkName: jest.fn(),
        getNetworkNameFromChainId: jest.fn().mockResolvedValue(chainName),
      } as jest.MockedObjectDeep<IZerionChainMappingService>;

      target = new ZerionPositionsApi(
        cacheService,
        loggingService,
        networkService,
        configurationService as IConfigurationService,
        new HttpErrorFactory(),
        zerionChainMappingService,
      );
    });

    it('does not normalize cached balances a second time', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const cachedBalances = [
        buildZerionLoanBalance({ chainName, value: -100 }),
      ];
      const cacheDir = CacheRouter.getZerionPositionsCacheDir({
        safeAddress,
        fiatCode: 'USD',
        refresh: undefined,
      });
      await cacheService.hSet(cacheDir, JSON.stringify(cachedBalances), 60);
      networkService.get.mockRejectedValueOnce(
        new Error('Unexpected request on cache hit'),
      );

      const res = (await target.getPositions({
        chain,
        safeAddress,
        fiatCode: 'USD',
      })) as unknown as Array<{
        fiatBalance: string | null;
        position_type: string;
      }>;

      expect(networkService.get).toHaveBeenCalledTimes(0);
      expect(res).toHaveLength(1);
      expect(res[0].position_type).toBe('loan');
      expect(res[0].fiatBalance).toBe('-100');
    });

    it('normalizes on cache miss and persists the normalized value for cache hits', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const apiBalances = [buildZerionLoanBalance({ chainName, value: 100 })];
      networkService.get.mockResolvedValueOnce({
        status: 200,
        data: rawify({ data: apiBalances }),
      });

      const first = (await target.getPositions({
        chain,
        safeAddress,
        fiatCode: 'USD',
      })) as unknown as Array<{
        fiatBalance: string | null;
        position_type: string;
      }>;

      expect(first).toHaveLength(1);
      expect(first[0].position_type).toBe('loan');
      expect(first[0].fiatBalance).toBe('-100');

      const cacheDir = CacheRouter.getZerionPositionsCacheDir({
        safeAddress,
        fiatCode: 'USD',
        refresh: undefined,
      });
      const cached = await cacheService.hGet(cacheDir);
      expect(cached).toBeDefined();
      const cachedParsed = JSON.parse(cached as string) as Array<ZerionBalance>;
      expect(cachedParsed[0].attributes.value).toBe(-100);

      const second = (await target.getPositions({
        chain,
        safeAddress,
        fiatCode: 'USD',
      })) as unknown as Array<{
        fiatBalance: string | null;
        position_type: string;
      }>;

      expect(networkService.get).toHaveBeenCalledTimes(1);
      expect(second).toHaveLength(1);
      expect(second[0].position_type).toBe('loan');
      expect(second[0].fiatBalance).toBe('-100');
    });
  });

  describe('API behavior tests', () => {
    let service: ZerionPositionsApi;
    let fakeConfigurationService: FakeConfigurationService;
    const zerionApiKey = faker.string.sample();
    const zerionBaseUri = faker.internet.url({ appendSlash: false });
    const defaultExpirationTimeInSeconds = faker.number.int();
    const supportedFiatCodes = Array.from(
      new Set([
        ...faker.helpers.multiple(() => faker.finance.currencyCode(), {
          count: { min: 2, max: 5 },
        }),
      ]),
    );

    const mockCacheService = jest.mocked({
      hGet: jest.fn(),
      hSet: jest.fn(),
      deleteByKey: jest.fn(),
    } as jest.MockedObjectDeep<ICacheService>);

    const mockLoggingService = {
      debug: jest.fn(),
      warn: jest.fn(),
    } as jest.MockedObjectDeep<ILoggingService>;

    const mockNetworkService = jest.mocked({
      get: jest.fn(),
    } as jest.MockedObjectDeep<INetworkService>);

    const mockHttpErrorFactory = jest.mocked({
      from: jest.fn(),
    } as jest.MockedObjectDeep<HttpErrorFactory>);

    const mockChainMappingService = jest.mocked({
      getNetworkNameFromChainId: jest.fn(),
      getChainIdFromNetworkName: jest.fn(),
    } as jest.MockedObjectDeep<IZerionChainMappingService>);

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
        'expirationTimeInSeconds.zerionPositions',
        defaultExpirationTimeInSeconds,
      );
      fakeConfigurationService.set(
        'balances.providers.zerion.currencies',
        supportedFiatCodes,
      );

      service = new ZerionPositionsApi(
        mockCacheService,
        mockLoggingService,
        mockNetworkService,
        fakeConfigurationService,
        mockHttpErrorFactory,
        mockChainMappingService,
      );
    });

    describe('getPositions', () => {
      it('should fail for an invalid fiatCode', async () => {
        const chain = chainBuilder().build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const fiatCode = faker.string.alphanumeric({
          exclude: supportedFiatCodes,
        });

        await expect(
          service.getPositions({
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
        mockCacheService.hGet.mockResolvedValue(null);
        mockNetworkService.get.mockResolvedValue({
          data: rawify({ data: [] }),
          status: 200,
        });

        await service.getPositions({
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
              'filter[positions]': 'only_complex',
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
        mockCacheService.hGet.mockResolvedValue(null);
        mockNetworkService.get.mockResolvedValue({
          data: rawify({ data: [] }),
          status: 200,
        });

        await service.getPositions({
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
              'filter[positions]': 'only_complex',
              currency: fiatCode.toLowerCase(),
              sort: 'value',
            },
          },
        });
      });

      it('should return empty array when chain is not supported', async () => {
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

        mockChainMappingService.getNetworkNameFromChainId.mockResolvedValue(
          null,
        );

        const result = await service.getPositions({
          chain,
          safeAddress,
          fiatCode,
        });

        expect(result).toEqual([]);
        expect(mockLoggingService.debug).toHaveBeenCalledWith(
          `Chain ${unsupportedChainId} not supported by Zerion, skipping positions`,
        );
      });

      it('should use chain mapping service when chainName is not configured', async () => {
        const chainId = '137';
        const mappedChainName = 'polygon';
        const chain = chainBuilder()
          .with('chainId', chainId)
          .with('isTestnet', false)
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', null).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);

        mockChainMappingService.getNetworkNameFromChainId.mockResolvedValue(
          mappedChainName,
        );
        mockCacheService.hGet.mockResolvedValue(null);
        mockNetworkService.get.mockResolvedValue({
          data: rawify({ data: [] }),
          status: 200,
        });

        await service.getPositions({
          chain,
          safeAddress,
          fiatCode,
        });

        expect(
          mockChainMappingService.getNetworkNameFromChainId,
        ).toHaveBeenCalledWith(chainId, false);
        expect(mockNetworkService.get).toHaveBeenCalledWith({
          url: `${zerionBaseUri}/v1/wallets/${safeAddress}/positions`,
          networkRequest: {
            headers: {
              Authorization: `Basic ${zerionApiKey}`,
            },
            params: {
              'filter[chain_ids]': mappedChainName,
              'filter[positions]': 'only_complex',
              currency: fiatCode.toLowerCase(),
              sort: 'value',
            },
          },
        });
      });

      it('should use chain mapping service with isTestnet flag', async () => {
        const chainId = '11155111';
        const mappedChainName = 'ethereum';
        const chain = chainBuilder()
          .with('chainId', chainId)
          .with('isTestnet', true)
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', null).build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);

        mockChainMappingService.getNetworkNameFromChainId.mockResolvedValue(
          mappedChainName,
        );
        mockCacheService.hGet.mockResolvedValue(null);
        mockNetworkService.get.mockResolvedValue({
          data: rawify({ data: [] }),
          status: 200,
        });

        await service.getPositions({
          chain,
          safeAddress,
          fiatCode,
        });

        expect(
          mockChainMappingService.getNetworkNameFromChainId,
        ).toHaveBeenCalledWith(chainId, true);
      });

      it('should not call chain mapping service when chainName is configured', async () => {
        const chain = chainBuilder()
          .with('isTestnet', false)
          .with(
            'balancesProvider',
            balancesProviderBuilder().with('chainName', 'ethereum').build(),
          )
          .build();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const fiatCode = faker.helpers.arrayElement(supportedFiatCodes);

        mockCacheService.hGet.mockResolvedValue(null);
        mockNetworkService.get.mockResolvedValue({
          data: rawify({ data: [] }),
          status: 200,
        });

        await service.getPositions({
          chain,
          safeAddress,
          fiatCode,
        });

        expect(
          mockChainMappingService.getNetworkNameFromChainId,
        ).not.toHaveBeenCalled();
      });
    });
  });
});
