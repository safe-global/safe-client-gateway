import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CoingeckoApi } from '@/datasources/balances-api/coingecko-api.service';
import { faker } from '@faker-js/faker';
import type { CacheFirstDataSource } from '../cache/cache.first.data.source';
import {
  getAssetPricesSchema,
  type AssetPrice,
} from '@/datasources/balances-api/entities/asset-price.entity';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import sortBy from 'lodash/sortBy';
import type { ILoggingService } from '@/logging/logging.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { pricesProviderBuilder } from '@/domain/chains/entities/__tests__/prices-provider.builder';
import { rawify } from '@/validation/entities/raw.entity';
import type { Cache } from 'cache-manager';
import { DataSourceError } from '@/domain/errors/data-source.error';

const MAX_BATCH_SIZE = 100;

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

const mockCacheService = jest.mocked({
  deleteByKey: jest.fn(),
  hGet: jest.fn(),
  hSet: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockLoggingService = {
  debug: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockInMemoryCache = {
  get: jest.fn(),
  set: jest.fn(),
} as jest.MockedObjectDeep<Cache>;

function buildCoinGeckoResponse(
  tokenAddresses: Array<string>,
  fiatCode: string,
): AssetPrice {
  const lowerCaseFiatCode = fiatCode.toLowerCase();
  return tokenAddresses.reduce<AssetPrice>((acc, tokenAddress) => {
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const change = faker.number.float({ min: -1, max: 1 });
    acc[tokenAddress] = {
      [lowerCaseFiatCode]: price,
      [`${lowerCaseFiatCode}_24h_change`]: change,
    };
    return acc;
  }, {});
}

describe('CoingeckoAPI', () => {
  let service: CoingeckoApi;
  let fakeConfigurationService: FakeConfigurationService;
  const coingeckoBaseUri = faker.internet.url({ appendSlash: false });
  const coingeckoApiKey = faker.string.sample();
  const pricesTtlSeconds = faker.number.int();
  const nativeCoinPricesTtlSeconds = faker.number.int();
  const highRefreshRateToken = faker.finance.ethereumAddress().toLowerCase();
  const highRefreshRateTokensTtlSeconds = faker.number.int();
  const notFoundPriceTtlSeconds = faker.number.int();
  const defaultExpirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();

  beforeEach(() => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'balances.providers.safe.prices.baseUri',
      coingeckoBaseUri,
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.apiKey',
      coingeckoApiKey,
    );
    fakeConfigurationService.set(
      `balances.providers.safe.prices.highRefreshRateTokens`,
      [highRefreshRateToken],
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.pricesTtlSeconds',
      pricesTtlSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.nativeCoinPricesTtlSeconds',
      nativeCoinPricesTtlSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.highRefreshRateTokensTtlSeconds',
      highRefreshRateTokensTtlSeconds,
    );
    fakeConfigurationService.set(
      'balances.providers.safe.prices.notFoundPriceTtlSeconds',
      notFoundPriceTtlSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      defaultExpirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
    service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
      mockInMemoryCache,
    );
  });

  it('should error if configuration is not defined', () => {
    const fakeConfigurationService = new FakeConfigurationService();

    expect(
      () =>
        new CoingeckoApi(
          fakeConfigurationService,
          mockCacheFirstDataSource,
          mockNetworkService,
          mockCacheService,
          mockLoggingService,
          mockInMemoryCache,
        ),
    ).toThrow();
  });

  it('should return fiat codes (using an API key)', async () => {
    mockCacheFirstDataSource.get.mockResolvedValue(
      rawify(['usd', 'eur', 'eth']),
    );

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toStrictEqual(['USD', 'EUR', 'ETH']);
    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir('safe_fiat_codes', ''),
      url: `${coingeckoBaseUri}/simple/supported_vs_currencies`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: defaultExpirationTimeInSeconds,
    });
  });

  it('should return fiat codes (with no API key)', async () => {
    mockCacheFirstDataSource.get.mockResolvedValue(
      rawify(['usd', 'eur', 'eth']),
    );
    fakeConfigurationService.set('balances.providers.safe.prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
      mockInMemoryCache,
    );

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toStrictEqual(['USD', 'EUR', 'ETH']);
    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir('safe_fiat_codes', ''),
      url: `${coingeckoBaseUri}/simple/supported_vs_currencies`,
      networkRequest: {},
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: defaultExpirationTimeInSeconds,
    });
  });

  it('should return an empty array and log error if pricesProvider.chainName is not defined', async () => {
    const chain = chainBuilder()
      .with(
        'pricesProvider',
        pricesProviderBuilder().with('chainName', null).build(),
      )
      .build();
    const tokenAddresses = [
      faker.finance.ethereumAddress(),
      faker.finance.ethereumAddress(),
    ];
    const fiatCode = faker.finance.currencyCode();

    const result = await service.getTokenPrices({
      chain,
      tokenAddresses,
      fiatCode,
    });

    expect(result).toStrictEqual([]);
    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      `Error getting token prices: Error: pricesProvider.chainName is not defined `,
    );
  });

  it('should return and cache one token price (using an API key)', async () => {
    const chain = chainBuilder().build();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const change = faker.number.float({ min: -1, max: 1 });
    const coingeckoPrice: AssetPrice = {
      [tokenAddress]: {
        [lowerCaseFiatCode]: price,
        [`${lowerCaseFiatCode}_24h_change`]: change,
      },
    };
    mockCacheService.hGet.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chain.pricesProvider.chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}`,
      '',
    );
    expect(assetPrice).toEqual([
      {
        [tokenAddress]: {
          [lowerCaseFiatCode]: price,
          [`${lowerCaseFiatCode}_24h_change`]: change,
        },
      },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(expectedCacheDir);
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      expectedCacheDir,
      JSON.stringify({
        [tokenAddress]: {
          [lowerCaseFiatCode]: price,
          [`${lowerCaseFiatCode}_24h_change`]: change,
        },
      }),
      pricesTtlSeconds,
    );
    expect(mockInMemoryCache.get).toHaveBeenCalledTimes(1);
    expect(mockInMemoryCache.get).toHaveBeenCalledWith(
      `${chain.pricesProvider.chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}:`,
    );
    expect(mockInMemoryCache.set).toHaveBeenCalledTimes(1);
    expect(mockInMemoryCache.set).toHaveBeenCalledWith(
      `${chain.pricesProvider.chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}:`,
      JSON.stringify({
        [tokenAddress]: {
          [lowerCaseFiatCode]: price,
          [`${lowerCaseFiatCode}_24h_change`]: change,
        },
      }),
      pricesTtlSeconds * 1_000, // milliseconds
    );
  });

  it('should return one token price from the in-memory cache', async () => {
    const chain = chainBuilder().build();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const change = faker.number.float({ min: -1, max: 1 });
    const coingeckoPrice: AssetPrice = {
      [tokenAddress]: {
        [lowerCaseFiatCode]: price,
        [`${lowerCaseFiatCode}_24h_change`]: change,
      },
    };
    mockInMemoryCache.get.mockResolvedValue(JSON.stringify(coingeckoPrice));

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    expect(assetPrice).toEqual([
      {
        [tokenAddress]: {
          [lowerCaseFiatCode]: price,
          [`${lowerCaseFiatCode}_24h_change`]: change,
        },
      },
    ]);
    expect(mockNetworkService.get).not.toHaveBeenCalled();
    expect(mockCacheService.hGet).not.toHaveBeenCalled();
    expect(mockInMemoryCache.get).toHaveBeenCalledTimes(1);
    expect(mockInMemoryCache.get).toHaveBeenCalledWith(
      `${chain.pricesProvider.chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}:`,
    );
  });

  it('should return and cache one token price (with no API key)', async () => {
    fakeConfigurationService.set('balances.providers.safe.prices.apiKey', null);
    const chain = chainBuilder().build();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const change = faker.number.float({ min: -1, max: 1 });
    const coingeckoPrice: AssetPrice = {
      [tokenAddress]: {
        [lowerCaseFiatCode]: price,
        [`${lowerCaseFiatCode}_24h_change`]: change,
      },
    };
    mockCacheService.hGet.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
      mockInMemoryCache,
    );

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chain.pricesProvider.chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}`,
      '',
    );
    expect(assetPrice).toEqual([
      {
        [tokenAddress]: {
          [lowerCaseFiatCode]: price,
          [`${lowerCaseFiatCode}_24h_change`]: change,
        },
      },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(expectedCacheDir);
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      expectedCacheDir,
      JSON.stringify({
        [tokenAddress]: {
          [lowerCaseFiatCode]: price,
          [`${lowerCaseFiatCode}_24h_change`]: change,
        },
      }),
      pricesTtlSeconds,
    );
  });

  it('should return and cache multiple token prices', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const firstChange = faker.number.float({ min: -1, max: 1 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondChange = faker.number.float({ min: -1, max: 1 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const thirdPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdChange = faker.number.float({ min: -1, max: 1 });
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: {
        [lowerCaseFiatCode]: firstPrice,
        [`${lowerCaseFiatCode}_24h_change`]: firstChange,
      },
      [secondTokenAddress]: {
        [lowerCaseFiatCode]: secondPrice,
        [`${lowerCaseFiatCode}_24h_change`]: secondChange,
      },
      [thirdTokenAddress]: {
        [lowerCaseFiatCode]: thirdPrice,
        [`${lowerCaseFiatCode}_24h_change`]: thirdChange,
      },
    };
    mockCacheService.hGet.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(assetPrice).toEqual([
      {
        [firstTokenAddress]: {
          [lowerCaseFiatCode]: firstPrice,
          [`${lowerCaseFiatCode}_24h_change`]: firstChange,
        },
      },
      {
        [secondTokenAddress]: {
          [lowerCaseFiatCode]: secondPrice,
          [`${lowerCaseFiatCode}_24h_change`]: secondChange,
        },
      },
      {
        [thirdTokenAddress]: {
          [lowerCaseFiatCode]: thirdPrice,
          [`${lowerCaseFiatCode}_24h_change`]: thirdChange,
        },
      },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [
            firstTokenAddress,
            secondTokenAddress,
            thirdTokenAddress,
          ].join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(3);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(3);
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [firstTokenAddress]: {
          [lowerCaseFiatCode]: firstPrice,
          [`${lowerCaseFiatCode}_24h_change`]: firstChange,
        },
      }),
      pricesTtlSeconds,
    );
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [secondTokenAddress]: {
          [lowerCaseFiatCode]: secondPrice,
          [`${lowerCaseFiatCode}_24h_change`]: secondChange,
        },
      }),
      pricesTtlSeconds,
    );
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [thirdTokenAddress]: {
          [lowerCaseFiatCode]: thirdPrice,
          [`${lowerCaseFiatCode}_24h_change`]: thirdChange,
        },
      }),
      pricesTtlSeconds,
    );
  });

  it('should return and cache multiple token prices from network, cache, and memory', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const firstChange = faker.number.float({ min: -1, max: 1 });
    const secondTokenAddress = highRefreshRateToken;
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondChange = faker.number.float({ min: -1, max: 1 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const thirdPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdChange = faker.number.float({ min: -1, max: 1 });

    // One token price from network, one from cache, and one from memory
    mockNetworkService.get.mockResolvedValue({
      data: rawify({
        [firstTokenAddress]: {
          [lowerCaseFiatCode]: firstPrice,
          [`${lowerCaseFiatCode}_24h_change`]: firstChange,
        },
      }),
      status: 200,
    });
    mockCacheService.hGet.mockImplementation((cacheDir) => {
      if (
        cacheDir.key ===
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`
      ) {
        return Promise.resolve(
          JSON.stringify({
            [secondTokenAddress]: {
              [lowerCaseFiatCode]: secondPrice,
              [`${lowerCaseFiatCode}_24h_change`]: secondChange,
            },
          }),
        );
      }
      return Promise.resolve(undefined);
    });
    mockInMemoryCache.get.mockImplementation((key) => {
      if (
        key ===
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}:`
      ) {
        return Promise.resolve(
          JSON.stringify({
            [thirdTokenAddress]: {
              [lowerCaseFiatCode]: thirdPrice,
              [`${lowerCaseFiatCode}_24h_change`]: thirdChange,
            },
          }),
        );
      }
      return Promise.resolve(null);
    });

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(assetPrice).toEqual(
      expect.arrayContaining([
        {
          [firstTokenAddress]: {
            [lowerCaseFiatCode]: firstPrice,
            [`${lowerCaseFiatCode}_24h_change`]: firstChange,
          },
        },
        {
          [secondTokenAddress]: {
            [lowerCaseFiatCode]: secondPrice,
            [`${lowerCaseFiatCode}_24h_change`]: secondChange,
          },
        },
        {
          [thirdTokenAddress]: {
            [lowerCaseFiatCode]: thirdPrice,
            [`${lowerCaseFiatCode}_24h_change`]: thirdChange,
          },
        },
      ]),
    );

    // mockNetworkService.get should have been called only once (when both cache and memory miss)
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: firstTokenAddress,
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    // mockInMemoryCache.get should have been called 3 times
    expect(mockInMemoryCache.get).toHaveBeenCalledTimes(3);
    expect(mockInMemoryCache.get).toHaveBeenCalledWith(
      `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}:`,
    );
    expect(mockInMemoryCache.get).toHaveBeenCalledWith(
      `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}:`,
    );
    expect(mockInMemoryCache.get).toHaveBeenCalledWith(
      `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}:`,
    );
    // mockInMemoryCache.set should have been called 2 times, to store the network price and the cache price
    expect(mockInMemoryCache.set).toHaveBeenCalledTimes(2);
    expect(mockInMemoryCache.set).toHaveBeenCalledWith(
      `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}:`,
      JSON.stringify({
        [firstTokenAddress]: {
          [lowerCaseFiatCode]: firstPrice,
          [`${lowerCaseFiatCode}_24h_change`]: firstChange,
        },
      }),
      pricesTtlSeconds * 1_000, // milliseconds
    );
    expect(mockInMemoryCache.set).toHaveBeenCalledWith(
      `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}:`,
      JSON.stringify({
        [secondTokenAddress]: {
          [lowerCaseFiatCode]: secondPrice,
          [`${lowerCaseFiatCode}_24h_change`]: secondChange,
        },
      }),
      highRefreshRateTokensTtlSeconds * 1_000, // milliseconds
    );
    // mockCacheService.hGet should have been called 2 times, once for the network and once for the cache
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(2);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    // mockCacheService.hSet should have been called only once, to store the network price
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [firstTokenAddress]: {
          [lowerCaseFiatCode]: firstPrice,
          [`${lowerCaseFiatCode}_24h_change`]: firstChange,
        },
      }),
      pricesTtlSeconds,
    );
  }, 100_000_000);

  it('should return and cache with low TTL one high-refresh-rate token price', async () => {
    const chain = chainBuilder().build();
    const highRefreshRateTokenAddress = faker.finance.ethereumAddress();
    const anotherTokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const change = faker.number.float({ min: -1, max: 1 });
    const anotherPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const anotherChange = faker.number.float({ min: -1, max: 1 });
    const coingeckoPrice: AssetPrice = {
      [highRefreshRateTokenAddress]: {
        [lowerCaseFiatCode]: price,
        [`${lowerCaseFiatCode}_24h_change`]: change,
      },
      [anotherTokenAddress]: {
        [lowerCaseFiatCode]: anotherPrice,
        [`${lowerCaseFiatCode}_24h_change`]: anotherChange,
      },
    };
    mockCacheService.hGet.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });
    fakeConfigurationService.set(
      `balances.providers.safe.prices.highRefreshRateTokens`,
      [
        faker.finance.ethereumAddress(),
        highRefreshRateTokenAddress.toUpperCase(), // to check this configuration is case insensitive
        faker.finance.ethereumAddress(),
      ],
    );
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
      mockInMemoryCache,
    );

    const assetPrice = await service.getTokenPrices({
      chain,
      tokenAddresses: [highRefreshRateTokenAddress, anotherTokenAddress],
      fiatCode,
    });

    expect(assetPrice).toEqual([
      {
        [highRefreshRateTokenAddress]: {
          [lowerCaseFiatCode]: price,
          [`${lowerCaseFiatCode}_24h_change`]: change,
        },
      },
      {
        [anotherTokenAddress]: {
          [lowerCaseFiatCode]: anotherPrice,
          [`${lowerCaseFiatCode}_24h_change`]: anotherChange,
        },
      },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [
            highRefreshRateTokenAddress,
            anotherTokenAddress,
          ].join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(2);
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(2);
    // high-refresh-rate token price is cached with highRefreshRateTokensTtlSeconds
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${highRefreshRateTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${highRefreshRateTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [highRefreshRateTokenAddress]: {
          [lowerCaseFiatCode]: price,
          [`${lowerCaseFiatCode}_24h_change`]: change,
        },
      }),
      highRefreshRateTokensTtlSeconds,
    );
    // another token price is cached with pricesCacheTtlSeconds
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${anotherTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${anotherTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [anotherTokenAddress]: {
          [lowerCaseFiatCode]: anotherPrice,
          [`${lowerCaseFiatCode}_24h_change`]: anotherChange,
        },
      }),
      pricesTtlSeconds,
    );
  });

  it('should cache new token prices only', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const firstChange = faker.number.float({ min: -1, max: 1 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondChange = faker.number.float({ min: -1, max: 1 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const thirdPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdChange = faker.number.float({ min: -1, max: 1 });
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: {
        [lowerCaseFiatCode]: firstPrice,
        [`${lowerCaseFiatCode}_24h_change`]: firstChange,
      },
      [thirdTokenAddress]: {
        [lowerCaseFiatCode]: thirdPrice,
        [`${lowerCaseFiatCode}_24h_change`]: thirdChange,
      },
    };
    mockCacheService.hGet.mockResolvedValueOnce(undefined);
    mockCacheService.hGet.mockResolvedValueOnce(
      JSON.stringify({
        [secondTokenAddress]: {
          [lowerCaseFiatCode]: secondPrice,
          [`${lowerCaseFiatCode}_24h_change`]: secondChange,
        },
      }),
    );
    mockCacheService.hGet.mockResolvedValueOnce(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const assetPrices = await service
      .getTokenPrices({
        chain,
        tokenAddresses: [
          firstTokenAddress,
          secondTokenAddress,
          thirdTokenAddress,
        ],
        fiatCode,
      })
      .then(getAssetPricesSchema(lowerCaseFiatCode).parse);

    expect(sortBy(assetPrices, (i) => Object.keys(i)[0])).toEqual(
      sortBy(
        [
          {
            [firstTokenAddress]: {
              [lowerCaseFiatCode]: firstPrice,
              [`${lowerCaseFiatCode}_24h_change`]: firstChange,
            },
          },
          {
            [secondTokenAddress]: {
              [lowerCaseFiatCode]: secondPrice,
              [`${lowerCaseFiatCode}_24h_change`]: secondChange,
            },
          },
          {
            [thirdTokenAddress]: {
              [lowerCaseFiatCode]: thirdPrice,
              [`${lowerCaseFiatCode}_24h_change`]: thirdChange,
            },
          },
        ],
        (i) => Object.keys(i)[0],
      ),
    );
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [firstTokenAddress, thirdTokenAddress].join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(3);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(2);
    expect(mockCacheService.hSet).toHaveBeenNthCalledWith(
      1,
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [firstTokenAddress]: {
          [lowerCaseFiatCode]: firstPrice,
          [`${lowerCaseFiatCode}_24h_change`]: firstChange,
        },
      }),
      pricesTtlSeconds,
    );
    expect(mockCacheService.hSet).toHaveBeenNthCalledWith(
      2,
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [thirdTokenAddress]: {
          [lowerCaseFiatCode]: thirdPrice,
          [`${lowerCaseFiatCode}_24h_change`]: thirdChange,
        },
      }),
      pricesTtlSeconds,
    );
  });

  it('should cache not found token prices with an extended TTL', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const firstChange = faker.number.float({ min: -1, max: 1 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondChange = faker.number.float({ min: -1, max: 1 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const coingeckoPrice: AssetPrice = {
      [firstTokenAddress]: {
        [lowerCaseFiatCode]: firstPrice,
        [`${lowerCaseFiatCode}_24h_change`]: firstChange,
      },
    };
    mockCacheService.hGet.mockResolvedValueOnce(
      JSON.stringify({
        [firstTokenAddress]: {
          [lowerCaseFiatCode]: null,
          [`${lowerCaseFiatCode}_24h_change`]: null,
        },
      }),
    );
    mockCacheService.hGet.mockResolvedValueOnce(
      JSON.stringify({
        [secondTokenAddress]: {
          [lowerCaseFiatCode]: secondPrice,
          [`${lowerCaseFiatCode}_24h_change`]: secondChange,
        },
      }),
    );
    mockCacheService.hGet.mockResolvedValueOnce(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const assetPrices = await service
      .getTokenPrices({
        chain,
        tokenAddresses: [
          firstTokenAddress,
          secondTokenAddress,
          thirdTokenAddress,
        ],
        fiatCode,
      })
      .then(getAssetPricesSchema(lowerCaseFiatCode).parse);

    expect(sortBy(assetPrices, (i) => Object.keys(i)[0])).toEqual(
      sortBy(
        [
          {
            [firstTokenAddress]: {
              [lowerCaseFiatCode]: null,
              [`${lowerCaseFiatCode}_24h_change`]: null,
            },
          },
          {
            [secondTokenAddress]: {
              [lowerCaseFiatCode]: secondPrice,
              [`${lowerCaseFiatCode}_24h_change`]: secondChange,
            },
          },
          {
            [thirdTokenAddress]: {
              [lowerCaseFiatCode]: null,
              [`${lowerCaseFiatCode}_24h_change`]: null,
            },
          },
        ],
        (i) => Object.keys(i)[0],
      ),
    );
    expect(mockNetworkService.get).toHaveBeenCalledWith({
      url: `${coingeckoBaseUri}/simple/token_price/${chain.pricesProvider.chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: thirdTokenAddress,
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    expect(mockCacheService.hGet).toHaveBeenCalledTimes(3);
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hGet).toHaveBeenCalledWith(
      new CacheDir(
        `${chain.pricesProvider.chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.hSet).toHaveBeenCalledTimes(1);
    expect(mockCacheService.hSet.mock.calls[0][1]).toEqual(
      JSON.stringify({
        [thirdTokenAddress]: {
          [lowerCaseFiatCode]: null,
          [`${lowerCaseFiatCode}_24h_change`]: null,
        },
      }),
    );
    expect(mockCacheService.hSet.mock.calls[0][2]).toBeGreaterThanOrEqual(
      fakeConfigurationService.get(
        'balances.providers.safe.prices.notFoundPriceTtlSeconds',
      ) as number,
    );
    expect(mockCacheService.hSet.mock.calls[0][2]).toBeLessThanOrEqual(
      (fakeConfigurationService.get(
        'balances.providers.safe.prices.notFoundPriceTtlSeconds',
      ) as number) + CoingeckoApi.NOT_FOUND_TTL_RANGE_SECONDS,
    );
  });

  it('should return the native coin price (using an API key)', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const change = faker.number.float({ min: -1, max: 1 });
    const expectedAssetPrice: AssetPrice = {
      [`${chain.pricesProvider.nativeCoin}`]: {
        [lowerCaseFiatCode]: price,
        [`${lowerCaseFiatCode}_24h_change`]: change,
      },
    };
    const cacheDir = new CacheDir(
      `${chain.pricesProvider.nativeCoin}_native_coin_price_${lowerCaseFiatCode}`,
      '',
    );
    mockCacheFirstDataSource.get.mockResolvedValue(rawify(expectedAssetPrice));

    await service.getNativeCoinPrice({ chain, fiatCode });

    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir,
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: nativeCoinPricesTtlSeconds,
    });
    expect(mockInMemoryCache.set).toHaveBeenCalledWith(
      `${cacheDir.key}:`,
      {
        [lowerCaseFiatCode]: price,
        [`${lowerCaseFiatCode}_24h_change`]: change,
      },
      nativeCoinPricesTtlSeconds * 1_000, // milliseconds
    );
  });

  it('should return the native coin price (with no API key)', async () => {
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const change = faker.number.float({ min: -1, max: 1 });
    const expectedAssetPrice: AssetPrice = {
      [`${chain.pricesProvider.nativeCoin}`]: {
        [lowerCaseFiatCode]: price,
        [`${lowerCaseFiatCode}_24h_change`]: change,
      },
    };
    const cacheDir = new CacheDir(
      `${chain.pricesProvider.nativeCoin}_native_coin_price_${lowerCaseFiatCode}`,
      '',
    );
    mockCacheFirstDataSource.get.mockResolvedValue(rawify(expectedAssetPrice));
    fakeConfigurationService.set('balances.providers.safe.prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
      mockInMemoryCache,
    );

    await service.getNativeCoinPrice({ chain, fiatCode });

    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir,
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        params: {
          ids: chain.pricesProvider.nativeCoin,
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: nativeCoinPricesTtlSeconds,
    });
    expect(mockInMemoryCache.set).toHaveBeenCalledWith(
      `${cacheDir.key}:`,
      {
        [lowerCaseFiatCode]: price,
        [`${lowerCaseFiatCode}_24h_change`]: change,
      },
      nativeCoinPricesTtlSeconds * 1_000, // milliseconds
    );
  });

  it('should return null and log error if pricesProvider.nativeCoin is not defined', async () => {
    const chain = chainBuilder()
      .with(
        'pricesProvider',
        pricesProviderBuilder().with('nativeCoin', null).build(),
      )
      .build();
    const fiatCode = faker.finance.currencyCode();

    const result = await service.getNativeCoinPrice({ chain, fiatCode });

    expect(result).toBeNull();
    expect(mockLoggingService.error).toHaveBeenCalledTimes(1);
    expect(mockLoggingService.error).toHaveBeenCalledWith(
      `Error getting native coin price: Error: pricesProvider.nativeCoinId is not defined `,
    );
  });

  it('should request prices from network', async () => {
    const chainName = faker.company.name();
    const tokenAddresses = faker.helpers.multiple(
      () => faker.finance.ethereumAddress(),
      {
        count: {
          min: 1,
          max: MAX_BATCH_SIZE,
        },
      },
    );
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const coingeckoPrice = buildCoinGeckoResponse(tokenAddresses, fiatCode);
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const result = await service._requestPricesFromNetwork({
      chainName,
      tokenAddresses,
      fiatCode,
    });

    expect(result).toStrictEqual(coingeckoPrice);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(mockNetworkService.get).toHaveBeenNthCalledWith(1, {
      url: `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddresses.join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
  });

  it('should deduplicate token addresses', async () => {
    const chainName = faker.company.name();
    const tokenAddressesToDeduplicate = [
      faker.finance.ethereumAddress(),
      faker.finance.ethereumAddress(),
    ];
    const tokenAddresses = faker.helpers
      .multiple(() => tokenAddressesToDeduplicate, {
        count: {
          min: 2,
          max: MAX_BATCH_SIZE,
        },
      })
      .flat();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const coingeckoPrice = buildCoinGeckoResponse(
      tokenAddressesToDeduplicate,
      fiatCode,
    );
    mockNetworkService.get.mockResolvedValue({
      data: rawify(coingeckoPrice),
      status: 200,
    });

    const result = await service._requestPricesFromNetwork({
      chainName,
      tokenAddresses,
      fiatCode,
    });

    expect(result).toStrictEqual(coingeckoPrice);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(1);
    expect(mockNetworkService.get).toHaveBeenNthCalledWith(1, {
      url: `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddressesToDeduplicate.join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
  });

  it('should batch request prices from network', async () => {
    const chainName = faker.company.name();
    const tokenAddresses = faker.helpers.multiple(
      () => faker.finance.ethereumAddress(),
      {
        count: {
          min: MAX_BATCH_SIZE + 1,
          max: MAX_BATCH_SIZE * 2,
        },
      },
    );
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const coingeckoPriceBatch1 = buildCoinGeckoResponse(
      tokenAddresses.slice(0, MAX_BATCH_SIZE),
      fiatCode,
    );
    const coingeckoPriceBatch2 = buildCoinGeckoResponse(
      tokenAddresses.slice(MAX_BATCH_SIZE),
      fiatCode,
    );
    mockNetworkService.get.mockResolvedValueOnce({
      data: rawify(coingeckoPriceBatch1),
      status: 200,
    });
    mockNetworkService.get.mockResolvedValueOnce({
      data: rawify(coingeckoPriceBatch2),
      status: 200,
    });

    const result = await service._requestPricesFromNetwork({
      chainName,
      tokenAddresses,
      fiatCode,
    });

    expect(result).toStrictEqual({
      ...coingeckoPriceBatch1,
      ...coingeckoPriceBatch2,
    });
    expect(mockNetworkService.get).toHaveBeenCalledTimes(2);
    expect(mockNetworkService.get).toHaveBeenNthCalledWith(1, {
      url: `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddresses.slice(0, MAX_BATCH_SIZE).join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    expect(mockNetworkService.get).toHaveBeenNthCalledWith(2, {
      url: `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddresses.slice(MAX_BATCH_SIZE).join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
  });

  it('should filter failed batch requests', async () => {
    const chainName = faker.company.name();
    const tokenAddresses = faker.helpers.multiple(
      () => faker.finance.ethereumAddress(),
      {
        count: {
          min: MAX_BATCH_SIZE + 1,
          max: MAX_BATCH_SIZE * 2,
        },
      },
    );
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const coingeckoPrice = buildCoinGeckoResponse(
      tokenAddresses.slice(0, MAX_BATCH_SIZE),
      fiatCode,
    );
    mockNetworkService.get.mockResolvedValueOnce({
      data: rawify(coingeckoPrice),
      status: 200,
    });
    mockNetworkService.get.mockRejectedValue(new Error('Network error'));

    const result = await service._requestPricesFromNetwork({
      chainName,
      tokenAddresses,
      fiatCode,
    });

    expect(result).toStrictEqual(coingeckoPrice);
    expect(mockNetworkService.get).toHaveBeenCalledTimes(2);
    expect(mockNetworkService.get).toHaveBeenNthCalledWith(1, {
      url: `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddresses.slice(0, MAX_BATCH_SIZE).join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
    expect(mockNetworkService.get).toHaveBeenNthCalledWith(2, {
      url: `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddresses.slice(MAX_BATCH_SIZE).join(','),
          vs_currencies: lowerCaseFiatCode,
          include_24hr_change: true,
        },
      },
    });
  });

  it('should throw if all batches fail', async () => {
    const chainName = faker.company.name();
    const tokenAddresses = faker.helpers.multiple(
      () => faker.finance.ethereumAddress(),
      {
        count: {
          min: MAX_BATCH_SIZE + 1,
          max: MAX_BATCH_SIZE * 2,
        },
      },
    );
    const fiatCode = faker.finance.currencyCode();
    mockNetworkService.get.mockRejectedValue(new Error('Network error'));

    await expect(
      service._requestPricesFromNetwork({
        chainName,
        tokenAddresses,
        fiatCode,
      }),
    ).rejects.toThrow(
      new DataSourceError(
        `Error getting ${tokenAddresses.join(',')} price from provider`,
      ),
    );
  });
});
