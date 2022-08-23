import { ConfigService } from '../services/config-service/config-service.service';
import fiatCodesFactory from '../services/exchange/entities/__tests__/fiat-codes.factory';
import { ExchangeService } from '../services/exchange/exchange.service';
import { TransactionServiceManager } from '../services/transaction-service/transaction-service.manager';
import { BalancesService } from './balances.service';

describe('BalancesService', () => {
  const exchangeService = {} as unknown as ExchangeService;
  const configService = {} as unknown as ConfigService;
  const transactionManager = {} as unknown as TransactionServiceManager;

  const service = new BalancesService(
    configService,
    transactionManager,
    exchangeService,
  );

  it('should get ordered supported fiat codes', async () => {
    const fiatCodesResult = fiatCodesFactory();
    exchangeService.getFiatCodes = jest
      .fn()
      .mockResolvedValueOnce(fiatCodesResult.symbols);

    const res = await service.getSupportedFiatCodes();

    expect(res).toEqual(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    expect(exchangeService.getFiatCodes).toHaveBeenCalledTimes(1);
  });
});
