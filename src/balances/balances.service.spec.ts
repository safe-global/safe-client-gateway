import { ConfigApi } from '../datasources/config-api/config-api.service';
import { ExchangeApi } from '../datasources/exchange-api/exchange-api.service';
import { TransactionApiManager } from '../datasources/transaction-api/transaction-api.manager';
import { BalancesService } from './balances.service';

describe('BalancesService', () => {
  const exchangeApi = {} as unknown as ExchangeApi;
  const configApi = {} as unknown as ConfigApi;
  const transactionApiManager = {} as unknown as TransactionApiManager;

  const service = new BalancesService(
    configApi,
    transactionApiManager,
    exchangeApi,
  );

  it('should get ordered supported fiat codes', async () => {
    const fiatCodesResult = ['AED', 'AFN', 'EUR', 'ALL', 'USD'];
    exchangeApi.getFiatCodes = jest.fn().mockResolvedValueOnce(fiatCodesResult);

    const res = await service.getSupportedFiatCodes();

    expect(res).toEqual(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    expect(exchangeApi.getFiatCodes).toHaveBeenCalledTimes(1);
  });
});
