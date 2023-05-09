import { ExchangeApi } from './exchange-api.service';
import { FakeConfigurationService } from '../../config/__tests__/fake.configuration.service';
import { faker } from '@faker-js/faker';
import { exchangeFiatCodesBuilder } from '../../domain/exchange/entities/__tests__/exchange-fiat-codes.builder';
import { exchangeRatesBuilder } from '../../domain/exchange/entities/__tests__/exchange-rates.builder';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { CacheDir } from '../cache/entities/cache-dir.entity';

const mockCacheFirstDataSource = jest.mocked({
  get: jest.fn(),
} as unknown as CacheFirstDataSource);

describe('ExchangeApi', () => {
  let service: ExchangeApi;
  let fakeConfigurationService: FakeConfigurationService;
  const exchangeBaseUri = faker.internet.url();
  const exchangeApiKey = faker.random.alphaNumeric();

  beforeAll(async () => {
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('exchange.baseUri', exchangeBaseUri);
    fakeConfigurationService.set('exchange.apiKey', exchangeApiKey);
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

  it('fiatCodes uses default cache TTL (12h) if none is set', async () => {
    const expectedFiatCodes = exchangeFiatCodesBuilder().build();
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);

    await service.getFiatCodes();

    expect(mockCacheFirstDataSource.get).toBeCalledWith(
      new CacheDir('exchange_fiat_codes', ''),
      `${exchangeBaseUri}/symbols`,
      { params: { access_key: exchangeApiKey } },
      60 * 60 * 12, // 12h in seconds
    );
  });

  it('fiatCodes uses set cache TTL', async () => {
    const exchangeBaseUri = faker.internet.url();
    const exchangeApiKey = faker.random.alphaNumeric();
    const ttl = 60;
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('exchange.baseUri', exchangeBaseUri);
    fakeConfigurationService.set('exchange.apiKey', exchangeApiKey);
    fakeConfigurationService.set('exchange.cacheTtlSeconds', ttl);
    const expectedFiatCodes = exchangeFiatCodesBuilder().build();
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);
    const target = new ExchangeApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    await target.getFiatCodes();

    expect(mockCacheFirstDataSource.get).toBeCalledWith(
      new CacheDir('exchange_fiat_codes', ''),
      `${exchangeBaseUri}/symbols`,
      { params: { access_key: exchangeApiKey } },
      ttl, // 60 seconds
    );
  });

  it('Should return the exchange rates', async () => {
    const expectedRates = exchangeRatesBuilder()
      .with('success', true)
      .with('rates', {
        USD: faker.datatype.number(),
      });
    mockCacheFirstDataSource.get.mockResolvedValue(expectedRates);

    const rates = await service.getRates();

    expect(rates).toBe(expectedRates);
  });

  it('exchangeRates uses default cache TTL (12h) if none is set', async () => {
    await service.getRates();

    expect(mockCacheFirstDataSource.get).toBeCalledWith(
      new CacheDir('exchange_rates', ''),
      `${exchangeBaseUri}/latest`,
      { params: { access_key: exchangeApiKey } },
      60 * 60 * 12, // 12h in seconds
    );
  });

  it('exchangeRates uses set cache TTL', async () => {
    const exchangeBaseUri = faker.internet.url();
    const exchangeApiKey = faker.random.alphaNumeric();
    const ttl = 60;
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('exchange.baseUri', exchangeBaseUri);
    fakeConfigurationService.set('exchange.apiKey', exchangeApiKey);
    fakeConfigurationService.set('exchange.cacheTtlSeconds', ttl);
    const expectedFiatCodes = exchangeFiatCodesBuilder().build();
    mockCacheFirstDataSource.get.mockResolvedValue(expectedFiatCodes);
    const target = new ExchangeApi(
      fakeConfigurationService,
      mockCacheFirstDataSource,
    );

    await target.getRates();

    expect(mockCacheFirstDataSource.get).toBeCalledWith(
      new CacheDir('exchange_rates', ''),
      `${exchangeBaseUri}/latest`,
      { params: { access_key: exchangeApiKey } },
      ttl, // 60 seconds
    );
  });
});
