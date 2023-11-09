import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CoingeckoApi } from '@/datasources/prices-api/coingecko-api.service';
import { faker } from '@faker-js/faker';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { AssetPrice } from '@/domain/prices/entities/asset-price.entity';
import { ICacheService } from '@/datasources/cache/cache.service.interface';

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as unknown as CacheFirstDataSource);

const mockCacheService = jest.mocked({
  deleteByKey: jest.fn(),
  expire: jest.fn(),
} as unknown as ICacheService);

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
    jest.clearAllMocks();
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
      mockCacheService,
    );
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    await expect(
      () =>
        new CoingeckoApi(
          fakeConfigurationService,
          mockCacheFirstDataSource,
          mockCacheService,
        ),
    ).toThrow();
  });

  it('should return fiat codes (using an API key)', async () => {
    const expectedFiatCodes = ['usd', 'eur', 'eth'];
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toBe(expectedFiatCodes);
    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir('fiat_codes', ''),
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
    const expectedFiatCodes = ['usd', 'eur', 'eth'];
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);
    fakeConfigurationService.set('prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockCacheService,
    );

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toBe(expectedFiatCodes);
    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir('fiat_codes', ''),
      url: `${coingeckoBaseUri}/simple/supported_vs_currencies`,
      networkRequest: {},
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: defaultExpirationTimeInSeconds,
    });
  });

  it('should return the token price (using an API key)', async () => {
    const expectedAssetPrice: AssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    const chainName = faker.string.sample();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();

    const assetPrice = await service.getTokenPrice({
      chainName,
      tokenAddress,
      fiatCode,
    });

    expect(assetPrice).toBe(expectedAssetPrice);
    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(
        `${chainName}_token_price_${tokenAddress}_${fiatCode}`,
        '',
      ),
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: fiatCode,
        },
      },
      url: `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('should return the token price (with no API key)', async () => {
    const expectedAssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    const chainName = faker.string.sample();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    fakeConfigurationService.set('prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockCacheService,
    );

    const assetPrice = await service.getTokenPrice({
      chainName,
      tokenAddress,
      fiatCode,
    });

    expect(assetPrice).toBe(expectedAssetPrice);
    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(
        `${chainName}_token_price_${tokenAddress}_${fiatCode}`,
        '',
      ),
      networkRequest: {
        params: {
          contract_addresses: tokenAddress,
          vs_currencies: fiatCode,
        },
      },
      url: `${coingeckoBaseUri}/simple/token_price/${chainName}`,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('should return the native coin price (using an API key)', async () => {
    const nativeCoinId = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const expectedAssetPrice: AssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);

    await service.getNativeCoinPrice({ nativeCoinId, fiatCode });

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(
        `${nativeCoinId}_native_coin_price_${fiatCode}`,
        '',
      ),
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': coingeckoApiKey,
        },
        params: {
          ids: nativeCoinId,
          vs_currencies: fiatCode,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('should return the native coin price (with no API key)', async () => {
    const nativeCoinId = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const expectedAssetPrice: AssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    fakeConfigurationService.set('prices.apiKey', null);
    const service = new CoingeckoApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
      mockCacheService,
    );

    await service.getNativeCoinPrice({ nativeCoinId, fiatCode });

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(
        `${nativeCoinId}_native_coin_price_${fiatCode}`,
        '',
      ),
      url: `${coingeckoBaseUri}/simple/price`,
      networkRequest: {
        params: {
          ids: nativeCoinId,
          vs_currencies: fiatCode,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('should call CacheService.expire when registering a not found token price', async () => {
    const chainName = faker.string.sample();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();

    await service.registerNotFoundTokenPrice({
      chainName,
      tokenAddress,
      fiatCode,
    });

    const expectedCacheDir = new CacheDir(
      `${chainName}_token_price_${tokenAddress}_${fiatCode}`,
      '',
    );
    expect(mockCacheService.expire).toHaveBeenCalledTimes(1);
    expect(mockCacheService.expire.mock.calls[0][0]).toBe(expectedCacheDir.key);
    expect(mockCacheService.expire.mock.calls[0][1]).toBeGreaterThanOrEqual(
      (fakeConfigurationService.get(
        'prices.notFoundPriceTtlSeconds',
      ) as number) - CoingeckoApi.notFoundTtlRangeSeconds,
    );
    expect(mockCacheService.expire.mock.calls[0][1]).toBeLessThanOrEqual(
      (fakeConfigurationService.get(
        'prices.notFoundPriceTtlSeconds',
      ) as number) + CoingeckoApi.notFoundTtlRangeSeconds,
    );
  });
});
