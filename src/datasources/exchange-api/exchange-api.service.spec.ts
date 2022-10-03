import { ExchangeApi } from './exchange-api.service';
import exchangeResultFactory from '../../domain/exchange/entities/__tests__/rates-exchange-result.factory';
import exchangeFiatCodesFactory from '../../domain/exchange/entities/__tests__/fiat-codes-exchange-result.factory';
import { FakeConfigurationService } from '../../config/__tests__/fake.configuration.service';
import { mockNetworkService } from '../network/__tests__/test.network.module';

describe('ExchangeApi', () => {
  let service: ExchangeApi;
  let fakeConfigurationService: FakeConfigurationService;

  beforeAll(async () => {
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set('exchange.baseUri', 'http://exchange.test');
    fakeConfigurationService.set('exchange.apiKey', 'aaaaaaaabbbbbbb');
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    service = new ExchangeApi(fakeConfigurationService, mockNetworkService);
  });

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();
    await expect(
      () => new ExchangeApi(fakeConfigurationService, mockNetworkService),
    ).toThrow();
  });

  it('Should return the fiat codes', async () => {
    const expectedFiatCodes = exchangeFiatCodesFactory(true, { USD: 'Dollar' });
    mockNetworkService.get.mockResolvedValue({ data: expectedFiatCodes });

    const fiatcodes = await service.getFiatCodes();

    expect(fiatcodes).toBe(expectedFiatCodes);
  });

  it('Should return the rates exchange result', async () => {
    const expectedRates = exchangeResultFactory(true, { USD: 2.0 });
    mockNetworkService.get.mockResolvedValue({ data: expectedRates });

    const rates = await service.getRates();

    expect(rates).toBe(expectedRates);
  });
});
