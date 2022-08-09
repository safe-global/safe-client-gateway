import { HttpService } from '@nestjs/axios';
import { Balance } from './entities/balance.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { SafeTransactionService } from './safe-transaction.service';

const BALANCES: Balance[] = [
  { tokenAddress: 'tokenAddress1', balance: 'balanceStr1' },
  { tokenAddress: 'tokenAddress2', balance: 'balanceStr2' },
];

const mockHttpService = {
  axiosRef: { get: jest.fn().mockResolvedValue({ data: BALANCES }) },
} as unknown as HttpService;

const mockHttpErrorHandler = {
  handle: jest.fn(),
} as unknown as HttpErrorHandler;

describe('SafeTransactionService', () => {
  const service: SafeTransactionService = new SafeTransactionService(
    'baseUrl',
    mockHttpService,
    mockHttpErrorHandler,
  );

  it('should return the data retrieved', async () => {
    const data = await service.getBalances('test', true, true);
    expect(data).toBe(BALANCES);
  });

  it('should call error handler when an error happens', async () => {
    mockHttpService.axiosRef.get = jest.fn().mockImplementationOnce(() => {
      throw new Error();
    });

    await service.getBalances('test', true, true);
    expect(mockHttpErrorHandler.handle).toHaveBeenCalledTimes(1);
  });
});
