import { faker } from '@faker-js/faker';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { ExchangeApi } from '@/datasources/exchange-api/exchange-api.service';
import { exchangeFiatCodesBuilder } from '@/domain/exchange/entities/__tests__/exchange-fiat-codes.builder';
import { exchangeRatesBuilder } from '@/domain/exchange/entities/__tests__/exchange-rates.builder';

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as unknown as CacheFirstDataSource);

describe('ExchangeApi', () => {
  let service: ExchangeApi;
  let fakeConfigurationService: FakeConfigurationService;
  const exchangeBaseUri = faker.internet.url({ appendSlash: false });
  const exchangeApiKey = faker.string.alphanumeric();
  const exchangeCacheTtlSeconds = faker.number.int();
  const notFoundExpirationTimeInSeconds = faker.number.int();

  beforeAll(async () => {
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('exchange.baseUri', exchangeBaseUri);
    fakeConfigurationService.set('exchange.apiKey', exchangeApiKey);
    fakeConfigurationService.set(
      'exchange.cacheTtlSeconds',
      exchangeCacheTtlSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new ExchangeApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();
    await expect(
      () => new ExchangeApi(fakeConfigurationService, mockCacheFirstDataSource),
    ).toThrow();
  });

  it('Should return the fiatCodes', async () => {
    const expectedFiatCodes = exchangeFiatCodesBuilder()
      .with('success', true)
      .with('symbols', {
        USD: 'Dollar',
      })
      .build();
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);

    const fiatCodes = await service.getFiatCodes();

    expect(fiatCodes).toBe(expectedFiatCodes);
  });

  it('fiatCodes uses set cache TTL', async () => {
    const exchangeBaseUri = faker.internet.url({ appendSlash: false });
    const exchangeApiKey = faker.string.alphanumeric();
    const ttl = 60;
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('exchange.baseUri', exchangeBaseUri);
    fakeConfigurationService.set('exchange.apiKey', exchangeApiKey);
    fakeConfigurationService.set('exchange.apiKey', exchangeApiKey);
    fakeConfigurationService.set('exchange.cacheTtlSeconds', ttl);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
    const expectedFiatCodes = exchangeFiatCodesBuilder().build();
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);
    const target = new ExchangeApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    await target.getFiatCodes();

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir('exchange_fiat_codes', ''),
      url: `${exchangeBaseUri}/symbols?access_key=${exchangeApiKey}`,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: ttl, // 60 seconds
    });
  });

  it('Should return the exchange rates', async () => {
    const expectedRates = exchangeRatesBuilder()
      .with('success', true)
      .with('rates', {
        USD: faker.number.int(),
      });
    mockCacheFirstDataSource.get.mockResolvedValue(expectedRates);

    const rates = await service.getRates();

    expect(rates).toBe(expectedRates);
  });

  it('exchangeRates uses set cache TTL', async () => {
    const exchangeBaseUri = faker.internet.url({ appendSlash: false });
    const exchangeApiKey = faker.string.alphanumeric();
    const ttl = 60;
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('exchange.baseUri', exchangeBaseUri);
    fakeConfigurationService.set('exchange.apiKey', exchangeApiKey);
    fakeConfigurationService.set('exchange.cacheTtlSeconds', ttl);
    fakeConfigurationService.set(
      'expirationTimeInSeconds.notFound.default',
      notFoundExpirationTimeInSeconds,
    );
    const expectedFiatCodes = exchangeFiatCodesBuilder().build();
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);
    const target = new ExchangeApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    await target.getRates();

    expect(mockCacheFirstDataSource.get).toBeCalledWith({
      cacheDir: new CacheDir('exchange_rates', ''),
      url: `${exchangeBaseUri}/latest?access_key=${exchangeApiKey}`,
      notFoundExpireTimeSeconds: notFoundExpirationTimeInSeconds,
      expireTimeSeconds: ttl, // 60 seconds
    });
  });
});
