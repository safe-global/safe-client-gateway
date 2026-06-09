// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import type { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import type { IConfigApi } from '@/domain/interfaces/config-api.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { BalancesApiManager } from '@/modules/balances/datasources/balances-api.manager';
import type { IPricesApi } from '@/modules/balances/datasources/prices-api.interface';
import { SafeBalancesApi } from '@/modules/balances/datasources/safe-balances-api.service';
import { balancesProviderBuilder } from '@/modules/chains/domain/entities/__tests__/balances-provider.builder';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const configurationServiceMock = jest.mocked(configurationService);

const configApi = {
  getChain: jest.fn(),
} as jest.MockedObjectDeep<IConfigApi>;

const configApiMock = jest.mocked(configApi);

const dataSource = {
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>;

const dataSourceMock = jest.mocked(dataSource);

const cacheService = {} as jest.MockedObjectDeep<ICacheService>;

const httpErrorFactory = {
  from: jest.fn(),
} as jest.MockedObjectDeep<HttpErrorFactory>;

const transactionApiManagerMock = {
  getApi: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApiManager>;

const transactionApiMock = {
  isSafe: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApi>;

const zerionBalancesApi = {
  getBalances: jest.fn(),
  clearBalances: jest.fn(),
  getCollectibles: jest.fn(),
  clearCollectibles: jest.fn(),
  getFiatCodes: jest.fn(),
  getBalance: jest.fn(),
} as IBalancesApi;

const zerionBalancesApiMock = jest.mocked(zerionBalancesApi);

const coingeckoApi = {
  getNativeCoinPrice: jest.fn(),
  getTokenPrices: jest.fn(),
  getFiatCodes: jest.fn(),
} as IPricesApi;

const coingeckoApiMock = jest.mocked(coingeckoApi);

const networkService = {
  get: jest.fn(),
  post: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>;

const networkServiceMock = jest.mocked(networkService);

beforeEach(() => {
  jest.resetAllMocks();
  configurationServiceMock.getOrThrow.mockImplementation((key) => {
    if (key === 'features.zerionBalancesEnabled') return false;
    if (key === 'features.counterfactualBalances') return true;
    // TODO: Remove after Vault decoding has been released
    if (key === 'application.isProduction') return true;
  });
});

describe('Balances API Manager Tests', () => {
  describe('getApi checks', () => {
    it('should return the Zerion API for a counterfactual Safe when Zerion is enabled for the chain', async () => {
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key === 'features.zerionBalancesEnabled') return true;
        if (key === 'features.counterfactualBalances') return true;
        if (key === 'application.isProduction') return true;
      });
      const chain = chainBuilder()
        .with(
          'balancesProvider',
          balancesProviderBuilder().with('enabled', true).build(),
        )
        .build();
      const manager = new BalancesApiManager(
        configurationService,
        configApiMock,
        dataSourceMock,
        cacheService,
        httpErrorFactory,
        zerionBalancesApiMock,
        coingeckoApiMock,
        transactionApiManagerMock,
        networkServiceMock,
      );
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      transactionApiManagerMock.getApi.mockResolvedValue(transactionApiMock);
      transactionApiMock.isSafe.mockResolvedValue(false);
      configApiMock.getChain.mockResolvedValue(rawify(chain));

      const result = await manager.getApi(chain.chainId, safeAddress);

      expect(result).toEqual(zerionBalancesApi);
    });

    it.each([
      ['Zerion is disabled for the chain', true, false],
      ['the global Zerion kill-switch is off', false, true],
    ])('should return the Safe Balances API for a counterfactual Safe when %s', async (_, zerionBalancesEnabled, chainEnabled) => {
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key === 'features.zerionBalancesEnabled')
          return zerionBalancesEnabled;
        if (key === 'features.counterfactualBalances') return true;
        if (key === 'application.isProduction') return true;
      });
      const chain = chainBuilder()
        .with(
          'balancesProvider',
          balancesProviderBuilder().with('enabled', chainEnabled).build(),
        )
        .build();
      const manager = new BalancesApiManager(
        configurationService,
        configApiMock,
        dataSourceMock,
        cacheService,
        httpErrorFactory,
        zerionBalancesApiMock,
        coingeckoApiMock,
        transactionApiManagerMock,
        networkServiceMock,
      );
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      transactionApiManagerMock.getApi.mockResolvedValue(transactionApiMock);
      transactionApiMock.isSafe.mockResolvedValue(false);
      configApiMock.getChain.mockResolvedValue(rawify(chain));

      const result = await manager.getApi(chain.chainId, safeAddress);

      expect(result).toBeInstanceOf(SafeBalancesApi);
      expect(result).not.toEqual(zerionBalancesApi);
    });

    const txServiceUrl = faker.internet.url({ appendSlash: false });
    const vpcTxServiceUrl = faker.internet.url({ appendSlash: false });

    /**
     * In the following tests, getBalances is used to check the parameters to
     * which {@link CacheFirstDataSource} was called with.
     */
    it.each([
      [true, vpcTxServiceUrl],
      [false, txServiceUrl],
    ])('vpcUrl is %s', async (useVpcUrl, expectedUrl) => {
      const fiatCode = faker.finance.currencyCode();
      const chain = chainBuilder()
        .with('chainId', faker.string.numeric())
        .with('transactionService', txServiceUrl)
        .with('vpcTransactionService', vpcTxServiceUrl)
        .build();
      const expirationTimeInSeconds = faker.number.int();
      const notFoundExpireTimeSeconds = faker.number.int();
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key === 'safeTransaction.useVpcUrl') return useVpcUrl;
        if (key === 'expirationTimeInSeconds.default')
          return expirationTimeInSeconds;
        if (key === 'expirationTimeInSeconds.notFound.default')
          return notFoundExpireTimeSeconds;
        if (key === 'features.zerionBalancesEnabled') return false;
        if (key === 'features.counterfactualBalances') return true;
        // TODO: Remove after Vault decoding has been released
        if (key === 'application.isProduction') return true;
        throw new Error(`Unexpected key: ${key}`);
      });
      configApiMock.getChain.mockResolvedValue(rawify(chain));
      dataSourceMock.get.mockResolvedValue(rawify([]));
      coingeckoApiMock.getTokenPrices.mockResolvedValue(rawify([]));
      const balancesApiManager = new BalancesApiManager(
        configurationService,
        configApiMock,
        dataSourceMock,
        cacheService,
        httpErrorFactory,
        zerionBalancesApiMock,
        coingeckoApiMock,
        transactionApiManagerMock,
        networkServiceMock,
      );
      transactionApiManagerMock.getApi.mockResolvedValue(transactionApiMock);
      transactionApiMock.isSafe.mockResolvedValue(true);

      const safeAddress = getAddress(faker.finance.ethereumAddress());
      const safeBalancesApi = await balancesApiManager.getApi(
        chain.chainId,
        safeAddress,
      );
      const trusted = faker.datatype.boolean();
      const excludeSpam = faker.datatype.boolean();

      await safeBalancesApi.getBalances({
        safeAddress,
        fiatCode,
        chain,
        trusted,
        excludeSpam,
      });

      expect(dataSourceMock.get).toHaveBeenCalledWith({
        cacheDir: expect.anything(),
        url: `${expectedUrl}/api/v1/safes/${safeAddress}/balances/`,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        expireTimeSeconds: expirationTimeInSeconds,
        networkRequest: expect.objectContaining({
          params: expect.objectContaining({
            trusted: trusted,
            exclude_spam: excludeSpam,
          }),
        }),
      });
    });
  });

  describe('getFiatCodes checks', () => {
    it('should return the intersection of all providers supported currencies', async () => {
      zerionBalancesApiMock.getFiatCodes.mockResolvedValue(
        rawify(['EUR', 'GBP', 'ETH']),
      );
      coingeckoApiMock.getFiatCodes.mockResolvedValue(rawify(['GBP']));
      const manager = new BalancesApiManager(
        configurationService,
        configApiMock,
        dataSourceMock,
        cacheService,
        httpErrorFactory,
        zerionBalancesApiMock,
        coingeckoApiMock,
        transactionApiManagerMock,
        networkServiceMock,
      );

      const result = await manager.getFiatCodes();

      expect(result).toStrictEqual(['GBP']);
    });
  });
});
