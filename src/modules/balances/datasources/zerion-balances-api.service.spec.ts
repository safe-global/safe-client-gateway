import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { ZerionBalancesApi } from '@/modules/balances/datasources/zerion-balances-api.service';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { balancesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/balances-provider.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IZerionChainMappingService } from '@/modules/zerion/datasources/zerion-chain-mapping.service';
import { rawify } from '@/validation/entities/raw.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

const mockCacheService = jest.mocked({
  increment: jest.fn(),
  hGet: jest.fn(),
  hSet: jest.fn(),
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

describe('ZerionBalancesApiService', () => {
  let service: ZerionBalancesApi;
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
      mockChainMappingService,
      fakeConfigurationService,
      mockHttpErrorFactory,
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

      // Mock chain mapping service to return null (chain not supported)
      mockChainMappingService.getNetworkNameFromChainId.mockResolvedValue(null);

      const result = await service.getBalances({
        chain,
        safeAddress,
        fiatCode,
      });

      expect(result).toEqual([]);
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        `Chain ${unsupportedChainId} not supported by Zerion, skipping balances`,
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
      mockNetworkService.get.mockResolvedValue({
        data: rawify({ data: [] }),
        status: 200,
      });

      await service.getBalances({
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
            currency: fiatCode.toLowerCase(),
            sort: 'value',
          },
        },
      });
    });
  });
});
