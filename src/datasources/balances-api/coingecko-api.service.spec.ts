import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CoingeckoApi } from '@/datasources/balances-api/coingecko-api.service';
import { faker } from '@faker-js/faker';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CoingeckoAssetPrice } from '@/datasources/balances-api/entities/coingecko-asset-price.entity';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { sortBy } from 'lodash';
import { ILoggingService } from '@/logging/logging.interface';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>);

const mockCacheService = jest.mocked({
  deleteByKey: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
} as jest.MockedObjectDeep<ICacheService>);

const mockNetworkService = jest.mocked({
  get: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

const mockLoggingService = {
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('CoingeckoAPI', () => {
  let service: CoingeckoApi;
  let fakeConfigurationService: FakeConfigurationService;
  const coingeckoBaseUri = faker.internet.url({ appendSlash: false });
  const coingeckoApiKey = faker.string.sample();
  const pricesCacheTtlSeconds = faker.number.int();
  const notFoundPriceTtlSeconds = faker.number.int();
  const defaultExpirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();

  beforeEach(async () => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('prices.baseUri', coingeckoBaseUri);
    fakeConfigurationService.set('prices.apiKey', coingeckoApiKey);
    fakeConfigurationService.set(
      'prices.pricesTtlSeconds',
      pricesCacheTtlSeconds,
    );
    fakeConfigurationService.set(
      'prices.notFoundPriceTtlSeconds',
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
    );
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    await expect(
      () =>
        new CoingeckoApi(
          fakeConfigurationService,
          mockCacheFirstDataSource,
          mockNetworkService,
          mockCacheService,
          mockLoggingService,
        ),
    ).toThrow();
  });

  it('should return fiat codes (using an API key)', async () => {
    mockCacheFirstDataSource.get.mockResolvedValue(['usd', 'eur', 'eth']);

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
    mockCacheFirstDataSource.get.mockResolvedValue(['usd', 'eur', 'eth']);
    fakeConfigurationService.set('prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
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

  it('should return and cache one token price (using an API key)', async () => {
    const chain = chainBuilder().build();
    const chainName = faker.string.sample();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
<<<<<<< HEAD
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
=======
    const price = faker.number.float({ min: 0.01, precision: 0.01 });
    const coingeckoPrice: CoingeckoAssetPrice = {
>>>>>>> c6bcaad0 (Move AssetPrice to CoingeckoAssetPrice)
      [tokenAddress]: { [lowerCaseFiatCode]: price },
    };
    mockCacheService.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });
    fakeConfigurationService.set(
      `prices.chains.${chain.chainId}.chainName`,
      chainName,
    );

    const assetPrice = await service.getTokenPrices({
      chainId: chain.chainId,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}`,
      '',
    );
    expect(assetPrice).toEqual([
      { [tokenAddress]: { [lowerCaseFiatCode]: price } },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: lowerCaseFiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(1);
    expect(mockCacheService.get).toHaveBeenCalledWith(expectedCacheDir);
    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      expectedCacheDir,
      JSON.stringify({ [tokenAddress]: { [lowerCaseFiatCode]: price } }),
      pricesCacheTtlSeconds,
    );
  });

  it('should return and cache one token price (with no API key)', async () => {
    fakeConfigurationService.set('prices.apiKey', null);
    const chain = chainBuilder().build();
    const chainName = faker.string.sample();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
<<<<<<< HEAD
    const price = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
=======
    const price = faker.number.float({ min: 0.01, precision: 0.01 });
    const coingeckoPrice: CoingeckoAssetPrice = {
>>>>>>> c6bcaad0 (Move AssetPrice to CoingeckoAssetPrice)
      [tokenAddress]: { [lowerCaseFiatCode]: price },
    };
    mockCacheService.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });
    fakeConfigurationService.set(
      `prices.chains.${chain.chainId}.chainName`,
      chainName,
    );
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );

    const assetPrice = await service.getTokenPrices({
      chainId: chain.chainId,
      tokenAddresses: [tokenAddress],
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chainName}_token_price_${tokenAddress}_${lowerCaseFiatCode}`,
      '',
    );
    expect(assetPrice).toEqual([
      { [tokenAddress]: { [lowerCaseFiatCode]: price } },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: lowerCaseFiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(1);
    expect(mockCacheService.get).toHaveBeenCalledWith(expectedCacheDir);
    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      expectedCacheDir,
      JSON.stringify({ [tokenAddress]: { [lowerCaseFiatCode]: price } }),
      pricesCacheTtlSeconds,
    );
  });

  it('should return and cache multiple token prices', async () => {
    const chainName = faker.string.sample();
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
<<<<<<< HEAD
    const thirdPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
=======
    const thirdPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const coingeckoPrice: CoingeckoAssetPrice = {
>>>>>>> c6bcaad0 (Move AssetPrice to CoingeckoAssetPrice)
      [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
      [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice },
      [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice },
    };
    fakeConfigurationService.set(
      `prices.chains.${chain.chainId}.chainName`,
      chainName,
    );
    mockCacheService.get.mockResolvedValue(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });

    const assetPrice = await service.getTokenPrices({
      chainId: chain.chainId,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(assetPrice).toEqual([
      { [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice } },
      { [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice } },
      { [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice } },
    ]);
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
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
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(3);
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.set).toHaveBeenCalledTimes(3);
    expect(mockCacheService.set).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
      }),
      pricesCacheTtlSeconds,
    );
    expect(mockCacheService.set).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice },
      }),
      pricesCacheTtlSeconds,
    );
    expect(mockCacheService.set).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice },
      }),
      pricesCacheTtlSeconds,
    );
  });

  it('should cache new token prices only', async () => {
    const chainName = faker.string.sample();
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
<<<<<<< HEAD
    const thirdPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const coingeckoPrice: AssetPrice = {
=======
    const thirdPrice = faker.number.float({ min: 0.01, precision: 0.01 });
    const coingeckoPrice: CoingeckoAssetPrice = {
>>>>>>> c6bcaad0 (Move AssetPrice to CoingeckoAssetPrice)
      [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
      [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice },
    };
    mockCacheService.get.mockResolvedValueOnce(undefined);
    mockCacheService.get.mockResolvedValueOnce(
      JSON.stringify({
        [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice },
      }),
    );
    mockCacheService.get.mockResolvedValueOnce(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });
    fakeConfigurationService.set(
      `prices.chains.${chain.chainId}.chainName`,
      chainName,
    );

    const assetPrices = await service.getTokenPrices({
      chainId: chain.chainId,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(sortBy(assetPrices, (i) => Object.keys(i)[0])).toEqual(
      sortBy(
        [
          { [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice } },
          { [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice } },
          { [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice } },
        ],
        (i) => Object.keys(i)[0],
      ),
    );
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: [firstTokenAddress, thirdTokenAddress].join(','),
          vs_currencies: lowerCaseFiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(3);
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.set).toHaveBeenCalledTimes(2);
    expect(mockCacheService.set).toHaveBeenNthCalledWith(
      1,
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
      }),
      pricesCacheTtlSeconds,
    );
    expect(mockCacheService.set).toHaveBeenNthCalledWith(
      2,
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
      JSON.stringify({
        [thirdTokenAddress]: { [lowerCaseFiatCode]: thirdPrice },
      }),
      pricesCacheTtlSeconds,
    );
  });

  it('should cache not found token prices with an extended TTL', async () => {
    const chainName = faker.string.sample();
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const firstTokenAddress = faker.finance.ethereumAddress();
    const firstPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const secondTokenAddress = faker.finance.ethereumAddress();
    const secondPrice = faker.number.float({ min: 0.01, multipleOf: 0.01 });
    const thirdTokenAddress = faker.finance.ethereumAddress();
    const coingeckoPrice: CoingeckoAssetPrice = {
      [firstTokenAddress]: { [lowerCaseFiatCode]: firstPrice },
    };
    mockCacheService.get.mockResolvedValueOnce(
      JSON.stringify({ [firstTokenAddress]: { [lowerCaseFiatCode]: null } }),
    );
    mockCacheService.get.mockResolvedValueOnce(
      JSON.stringify({
        [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice },
      }),
    );
    mockCacheService.get.mockResolvedValueOnce(undefined);
    mockNetworkService.get.mockResolvedValue({
      data: coingeckoPrice,
      status: 200,
    });
    fakeConfigurationService.set(
      `prices.chains.${chain.chainId}.chainName`,
      chainName,
    );

    const assetPrices = await service.getTokenPrices({
      chainId: chain.chainId,
      tokenAddresses: [
        firstTokenAddress,
        secondTokenAddress,
        thirdTokenAddress,
      ],
      fiatCode,
    });

    expect(sortBy(assetPrices, (i) => Object.keys(i)[0])).toEqual(
      sortBy(
        [
          { [firstTokenAddress]: { [lowerCaseFiatCode]: null } },
          { [secondTokenAddress]: { [lowerCaseFiatCode]: secondPrice } },
          { [thirdTokenAddress]: { [lowerCaseFiatCode]: null } },
        ],
        (i) => Object.keys(i)[0],
      ),
    );
    expect(mockNetworkService.get).toHaveBeenCalledWith(
      `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: thirdTokenAddress,
          vs_currencies: lowerCaseFiatCode,
        },
      },
    );
    expect(mockCacheService.get).toHaveBeenCalledTimes(3);
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${firstTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${secondTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.get).toHaveBeenCalledWith(
      new CacheDir(
        `${chainName}_token_price_${thirdTokenAddress}_${lowerCaseFiatCode}`,
        '',
      ),
    );
    expect(mockCacheService.set).toHaveBeenCalledTimes(1);
    expect(mockCacheService.set.mock.calls[0][1]).toEqual(
      JSON.stringify({ [thirdTokenAddress]: { [lowerCaseFiatCode]: null } }),
    );
    expect(mockCacheService.set.mock.calls[0][2]).toBeGreaterThanOrEqual(
      (fakeConfigurationService.get(
        'prices.notFoundPriceTtlSeconds',
      ) as number) - CoingeckoApi.notFoundTtlRangeSeconds,
    );
    expect(mockCacheService.set.mock.calls[0][2]).toBeLessThanOrEqual(
      (fakeConfigurationService.get(
        'prices.notFoundPriceTtlSeconds',
      ) as number) + CoingeckoApi.notFoundTtlRangeSeconds,
    );
  });

  it('should return the native coin price (using an API key)', async () => {
    const nativeCoinId = faker.string.sample();
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const expectedAssetPrice: CoingeckoAssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    fakeConfigurationService.set(
      `prices.chains.${chain.chainId}.nativeCoin`,
      nativeCoinId,
    );

    await service.getNativeCoinPrice({
      chainId: chain.chainId,
      fiatCode,
    });

    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir(
        `${nativeCoinId}_native_coin_price_${lowerCaseFiatCode}`,
        '',
      ),
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          ids: nativeCoinId,
          vs_currencies: lowerCaseFiatCode,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('should return the native coin price (with no API key)', async () => {
    const nativeCoinId = faker.string.sample();
    const chain = chainBuilder().build();
    const fiatCode = faker.finance.currencyCode();
    const lowerCaseFiatCode = fiatCode.toLowerCase();
    const expectedAssetPrice: CoingeckoAssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    fakeConfigurationService.set('prices.apiKey', null);
    fakeConfigurationService.set(
      `prices.chains.${chain.chainId}.nativeCoin`,
      nativeCoinId,
    );
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockNetworkService,
      mockCacheService,
      mockLoggingService,
    );

    await service.getNativeCoinPrice({ chainId: chain.chainId, fiatCode });

    expect(mockCacheFirstDataSource.get).toHaveBeenCalledWith({
      cacheDir: new CacheDir(
        `${nativeCoinId}_native_coin_price_${lowerCaseFiatCode}`,
        '',
      ),
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        params: {
          ids: nativeCoinId,
          vs_currencies: lowerCaseFiatCode,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });
});
