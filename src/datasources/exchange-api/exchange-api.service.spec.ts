import { ExchangeApi } from './exchange-api.service';
import { ExchangeResult } from '../../domain/exchange/entities/exchange-result.entity';
import { FiatCodesExchangeResult } from '../../domain/exchange/entities/fiat-codes-result.entity';
import { FakeConfigurationService } from '../../common/config/__tests__/fake.configuration.service';
import { mockNetworkService } from '../../datasources/network/__tests__/test.network.module';

const FIATCODES: FiatCodesExchangeResult = {
  success: true,
  symbols: {},
};

const EXCHANGERESULT: ExchangeResult = {
  success: true,
  rates: {},
  base: '',
};

describe('ExchangeApi', () => {
  const fakeConfigurationService = new FakeConfigurationService();
  fakeConfigurationService.set('exchange.baseUri', 'http://exchange.test');
  fakeConfigurationService.set('exchange.apiKey', 'aaaaaaaabbbbbbb');
  const service: ExchangeApi = new ExchangeApi(
    fakeConfigurationService,
    mockNetworkService,
  );

  it('should error if configuration is not defined', async () => {
    const fakeConfigurationService = new FakeConfigurationService();
    await expect(
      () => new ExchangeApi(fakeConfigurationService, mockNetworkService),
    ).toThrow();
  });

  it('Should return the fiatcodes', async () => {
    mockNetworkService.get.mockResolvedValue({ data: FIATCODES });
    const fiatcodes = await service.getFiatCodes();
    expect(fiatcodes).toBe(FIATCODES);
  });

  it('Should return the exchange result', async () => {
    mockNetworkService.get.mockResolvedValue({ data: EXCHANGERESULT });
    const exchangeresult = await service.getExchangeResult();
    expect(exchangeresult).toBe(EXCHANGERESULT);
  });
});
