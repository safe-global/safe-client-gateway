import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { PricesApi } from '@/datasources/prices-api/prices-api.service';
import { faker } from '@faker-js/faker';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as unknown as CacheFirstDataSource);

describe('PricesApi', () => {
  let service: PricesApi;
  let fakeConfigurationService: FakeConfigurationService;
  const pricesBaseUri = faker.internet.url({ appendSlash: false });
  const pricesApiKey = faker.string.sample();
  const pricesCacheTtlSeconds = faker.number.int();
  const defaultExpirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();

  beforeEach(async () => {
    jest.clearAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('prices.baseUri', pricesBaseUri);
    fakeConfigurationService.set('prices.apiKey', pricesApiKey);
    fakeConfigurationService.set(
      'prices.pricesTtlSeconds',
      pricesCacheTtlSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      defaultExpirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
    service = new PricesApi(fakeConfigurationService, mockCacheFirstDataSource);
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    await expect(
      () => new PricesApi(fakeConfigurationService, mockCacheFirstDataSource),
    ).toThrow();
  });

  it('should return fiat codes (using an API key)', async () => {
    const expectedFiatCodes = ['usd', 'eur', 'eth'];
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toBe(expectedFiatCodes);
    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir('price_fiat_code', ''),
      url: `${pricesBaseUri}/simple/supported_vs_currencies`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': pricesApiKey,
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
    const service = new PricesApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toBe(expectedFiatCodes);
    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir('price_fiat_code', ''),
      url: `${pricesBaseUri}/simple/supported_vs_currencies`,
      networkRequest: undefined,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: defaultExpirationTimeInSeconds,
    });
  });

  it('should return the token price (using an API key)', async () => {
    const expectedAssetPrice = { gnosis: { eur: 98.86 } };
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
        `${chainName}_token_price`,
        `${tokenAddress}_${fiatCode}`,
      ),
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': pricesApiKey,
        },
      },
      url: `${pricesBaseUri}/simple/token_price/${chainName}?contract_addresses=${tokenAddress}&vs_currencies=${fiatCode}`,
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
    const service = new PricesApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    const assetPrice = await service.getTokenPrice({
      chainName,
      tokenAddress,
      fiatCode,
    });

    expect(assetPrice).toBe(expectedAssetPrice);
    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(
        `${chainName}_token_price`,
        `${tokenAddress}_${fiatCode}`,
      ),
      networkRequest: undefined,
      url: `${pricesBaseUri}/simple/token_price/${chainName}?contract_addresses=${tokenAddress}&vs_currencies=${fiatCode}`,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('should return the native coin price (using an API key)', async () => {
    const nativeCoinId = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const expectedAssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);

    await service.getNativeCoinPrice({ nativeCoinId, fiatCode });

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(`${nativeCoinId}_native_coin_price`, fiatCode),
      url: `${pricesBaseUri}/simple/price?ids=${nativeCoinId}&vs_currencies=${fiatCode}`,
      networkRequest: {
        headers: {
          'x-cg-pro-api-key': pricesApiKey,
        },
      },
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('should return the native coin price (with no API key)', async () => {
    const nativeCoinId = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const expectedAssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    fakeConfigurationService.set('prices.apiKey', null);
    const service = new PricesApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    await service.getNativeCoinPrice({ nativeCoinId, fiatCode });

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(`${nativeCoinId}_native_coin_price`, fiatCode),
      url: `${pricesBaseUri}/simple/price?ids=${nativeCoinId}&vs_currencies=${fiatCode}`,
      networkRequest: undefined,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });
});
