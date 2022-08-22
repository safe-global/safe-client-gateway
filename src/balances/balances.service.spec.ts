import { ConfigService } from '../services/config-service/config-service.service';
import { ExchangeService } from '../services/exchange/exchange.service';
import { TransactionServiceManager } from '../services/transaction-service/transaction-service.manager';
import { BalancesService } from './balances.service';

const FIAT_CODES_RESPONSE: string[] = ['AED', 'AFN', 'EUR', 'ALL', 'USD'];

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
    exchangeService.getFiatCodes = jest
      .fn()
      .mockResolvedValueOnce(FIAT_CODES_RESPONSE);

    const res = await service.getSupportedFiatCodes();

    expect(res).toEqual(['USD', 'EUR', 'AED', 'AFN', 'ALL']);
    expect(exchangeService.getFiatCodes).toHaveBeenCalledTimes(1);
  });
});
