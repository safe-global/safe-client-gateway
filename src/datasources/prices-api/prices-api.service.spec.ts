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
  const pricesApiKey = faker.string.alphanumeric();
  const pricesCacheTtlSeconds = faker.number.int();
  const defaultExpirationTimeInSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();

  beforeAll(async () => {
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
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new PricesApi(fakeConfigurationService, mockCacheFirstDataSource);
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();

    await expect(
      () => new PricesApi(fakeConfigurationService, mockCacheFirstDataSource),
    ).toThrow();
  });

  it('should return fiat codes', async () => {
    const expectedFiatCodes = ['usd', 'eur', 'eth'];
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toBe(expectedFiatCodes);
  });

  it('fiat codes use default cache TTL', async () => {
    const expectedFiatCodes = ['usd', 'eur', 'eth'];
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);
    const service = new PricesApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    await service.getFiatCodes();

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir('price_fiat_code', ''),
      url: `${pricesBaseUri}/simple/supported_vs_currencies`,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: defaultExpirationTimeInSeconds,
    });
  });

  it('should return the token price', async () => {
    const expectedAssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);

    const assetPrice = await service.getTokenPrice({
      chainName: faker.string.sample(),
      tokenAddress: faker.finance.ethereumAddress(),
      fiatCode: faker.finance.currencyCode(),
    });

    expect(assetPrice).toBe(expectedAssetPrice);
  });

  it('token price retrieval uses prices cache TTL', async () => {
    const chainName = faker.string.sample();
    const tokenAddress = faker.finance.ethereumAddress();
    const fiatCode = faker.finance.currencyCode();
    const expectedAssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    const service = new PricesApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    await service.getTokenPrice({ chainName, tokenAddress, fiatCode });

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(
        `${chainName}_token_price`,
        `${tokenAddress}_${fiatCode}`,
      ),
      url: `${pricesBaseUri}/simple/token_price/${chainName}?contract_addresses=${tokenAddress}&vs_currencies=${fiatCode}`,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });

  it('native coin retrieval uses prices cache TTL', async () => {
    const nativeCoinId = faker.string.sample();
    const fiatCode = faker.finance.currencyCode();
    const expectedAssetPrice = { gnosis: { eur: 98.86 } };
    mockCacheFirstDataSource.get.mockResolvedValue(expectedAssetPrice);
    const service = new PricesApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    await service.getNativeCoinPrice({ nativeCoinId, fiatCode });

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir(`${nativeCoinId}_native_coin_price`, fiatCode),
      url: `${pricesBaseUri}/simple/price?ids=${nativeCoinId}&vs_currencies=${fiatCode}`,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: pricesCacheTtlSeconds,
    });
  });
});
