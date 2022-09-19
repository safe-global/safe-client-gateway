import { ExchangeApi } from './exchange-api.service';
import exchangeResultFactory from '../../domain/exchange/entities/__tests__/exchange.factory';
import exchangeFiatCodesFactory from '../../domain/exchange/entities/__tests__/fiat-codes.factory';
import { FakeConfigurationService } from '../../common/config/__tests__/fake.configuration.service';
import { mockNetworkService } from '../../datasources/network/__tests__/test.network.module';

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

  it('Should return the fiatcodes', async () => {
    const expectedFiatCodes = exchangeFiatCodesFactory(true, { USD: 'Dollar' });
    mockNetworkService.get.mockResolvedValue({ data: expectedFiatCodes });

    const fiatcodes = await service.getFiatCodes();

    expect(fiatcodes).toBe(expectedFiatCodes);
  });

  it('Should return the exchange result', async () => {
    const expectedExchangeResult = exchangeResultFactory(true, { USD: 2.0 });
    mockNetworkService.get.mockResolvedValue({ data: expectedExchangeResult });

    const exchangeresult = await service.getExchangeResult();

    expect(exchangeresult).toBe(expectedExchangeResult);
  });
});
