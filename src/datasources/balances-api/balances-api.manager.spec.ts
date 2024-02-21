import { IConfigurationService } from '@/config/configuration.service.interface';
import { BalancesApiManager } from '@/datasources/balances-api/balances-api.manager';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { IBalancesApi } from '@/domain/interfaces/balances-api.interface';
import { IConfigApi } from '@/domain/interfaces/config-api.interface';
import { IPricesApi } from '@/datasources/balances-api/prices-api.interface';
import { faker } from '@faker-js/faker';

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

const zerionBalancesApi = {
  getBalances: jest.fn(),
  clearBalances: jest.fn(),
  getCollectibles: jest.fn(),
  clearCollectibles: jest.fn(),
  getFiatCodes: jest.fn(),
} as IBalancesApi;

const zerionBalancesApiMock = jest.mocked(zerionBalancesApi);

const coingeckoApi = {
  getNativeCoinPrice: jest.fn(),
  getTokenPrices: jest.fn(),
  getFiatCodes: jest.fn(),
} as IPricesApi;

const coingeckoApiMock = jest.mocked(coingeckoApi);

beforeEach(() => {
  jest.resetAllMocks();
  configurationServiceMock.getOrThrow.mockImplementation((key) => {
    if (key === 'features.zerionBalancesChainIds') return ['1', '2', '3'];
  });
});

describe('Balances API Manager Tests', () => {
  describe('getBalancesApi checks', () => {
    it('should return the Zerion API', async () => {
      const manager = new BalancesApiManager(
        configurationService,
        configApiMock,
        dataSourceMock,
        cacheService,
        httpErrorFactory,
        zerionBalancesApiMock,
        coingeckoApiMock,
      );

      const result = await manager.getBalancesApi('2');

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
      const zerionChainIds = ['1', '2', '3'];
      const fiatCode = faker.finance.currencyCode();
      const chain = chainBuilder()
        .with('chainId', '4')
        .with('transactionService', txServiceUrl)
        .with('vpcTransactionService', vpcTxServiceUrl)
        .build();
      const expirationTimeInSeconds = faker.number.int();
      const notFoundExpireTimeSeconds = faker.number.int();
      configurationServiceMock.getOrThrow.mockImplementation((key) => {
        if (key === 'safeTransaction.useVpcUrl') return useVpcUrl;
        else if (key === 'expirationTimeInSeconds.default')
          return expirationTimeInSeconds;
        else if (key === 'expirationTimeInSeconds.notFound.default')
          return notFoundExpireTimeSeconds;
        else if (key === 'features.zerionBalancesChainIds')
          return zerionChainIds;
        throw new Error(`Unexpected key: ${key}`);
      });
      configApiMock.getChain.mockResolvedValue(chain);
      dataSourceMock.get.mockResolvedValue([]);
      const balancesApiManager = new BalancesApiManager(
        configurationService,
        configApiMock,
        dataSourceMock,
        cacheService,
        httpErrorFactory,
        zerionBalancesApiMock,
        coingeckoApiMock,
      );

      const safeBalancesApi = await balancesApiManager.getBalancesApi(
        chain.chainId,
      );
      const safeAddress = faker.finance.ethereumAddress();
      const trusted = faker.datatype.boolean();
      const excludeSpam = faker.datatype.boolean();

      await safeBalancesApi.getBalances({
        safeAddress,
        fiatCode,
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
      zerionBalancesApiMock.getFiatCodes.mockResolvedValue([
        'EUR',
        'GBP',
        'ETH',
      ]);
      coingeckoApiMock.getFiatCodes.mockResolvedValue(['GBP']);
      const manager = new BalancesApiManager(
        configurationService,
        configApiMock,
        dataSourceMock,
        cacheService,
        httpErrorFactory,
        zerionBalancesApiMock,
        coingeckoApiMock,
      );

      const result = await manager.getFiatCodes();

      expect(result).toStrictEqual(['GBP']);
    });
  });
});
