// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
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
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';

const configurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const configurationServiceMock = vi.mocked(configurationService);

const configApi = {
  getChain: vi.fn(),
} as MockedObject<IConfigApi>;

const configApiMock = vi.mocked(configApi);

const dataSource = {
  get: vi.fn(),
} as MockedObject<CacheFirstDataSource>;

const dataSourceMock = vi.mocked(dataSource);

const cacheService = {} as MockedObject<ICacheService>;

const httpErrorFactory = {
  from: vi.fn(),
} as MockedObject<HttpErrorFactory>;

const transactionApiManagerMock = {
  getApi: vi.fn(),
} as MockedObject<ITransactionApiManager>;

const transactionApiMock = {
  isSafe: vi.fn(),
} as MockedObject<ITransactionApi>;

const zerionBalancesApi = {
  getBalances: vi.fn(),
  clearBalances: vi.fn(),
  getCollectibles: vi.fn(),
  clearCollectibles: vi.fn(),
  getFiatCodes: vi.fn(),
  getBalance: vi.fn(),
} as IBalancesApi;

const zerionBalancesApiMock = vi.mocked(zerionBalancesApi);

const coingeckoApi = {
  getNativeCoinPrice: vi.fn(),
  getTokenPrices: vi.fn(),
  getFiatCodes: vi.fn(),
} as IPricesApi;

const coingeckoApiMock = vi.mocked(coingeckoApi);

const networkService = {
  get: vi.fn(),
  post: vi.fn(),
} as MockedObject<INetworkService>;

const networkServiceMock = vi.mocked(networkService);

beforeEach(() => {
  vi.resetAllMocks();
  configurationServiceMock.getOrThrow.mockImplementation((key) => {
    if (key === 'features.zerionEnabled') return false;
    if (key === 'features.counterfactualBalances') return true;
    // TODO: Remove after Vault decoding has been released
    if (key === 'application.isProduction') return true;
  });
});

describe('Balances API Manager Tests', () => {
  describe('getApi checks', () => {
    it('should return the Zerion API if the Safe address is not known by the Safe Transaction Service', async () => {
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
      const chainId = faker.string.numeric();
      transactionApiManagerMock.getApi.mockResolvedValue(transactionApiMock);
      transactionApiMock.isSafe.mockResolvedValue(false);

      const result = await manager.getApi(chainId, safeAddress);

      expect(result).toEqual(zerionBalancesApi);
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
        if (key === 'features.zerionEnabled') return false;
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
