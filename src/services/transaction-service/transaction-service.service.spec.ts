import { HttpService } from '@nestjs/axios';
import { Balance } from './entities/balance.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { TransactionService } from './transaction-service.service';
import { Backbone } from '../../chains/entities/backbone.entity';

const BALANCES: Balance[] = [
  { tokenAddress: 'tokenAddress1', balance: 'balanceStr1' },
  { tokenAddress: 'tokenAddress2', balance: 'balanceStr2' },
];

const BACKBONE: Backbone = {
  name: 'testName',
  version: '',
  api_version: '',
  secure: false,
  host: '',
  headers: [],
  settings: undefined,
};

const mockHttpService = {
  axiosRef: { get: jest.fn() },
} as unknown as HttpService;

const mockHttpErrorHandler = {
  handle: jest.fn(),
} as unknown as HttpErrorHandler;

describe('TransactionService', () => {
  const service: TransactionService = new TransactionService(
    'baseUrl',
    mockHttpService,
    mockHttpErrorHandler,
  );

  it('should return the balances retrieved', async () => {
    mockHttpService.axiosRef.get = jest
      .fn()
      .mockResolvedValue({ data: BALANCES });

    const balances = await service.getBalances('test', true, true);
    expect(balances).toBe(BALANCES);
  });

  it('should return the backbone retrieved', async () => {
    mockHttpService.axiosRef.get = jest
      .fn()
      .mockResolvedValueOnce({ data: BACKBONE });

    const backbone = await service.getBackbone();
    expect(backbone).toBe(BACKBONE);
  });

  it('should call error handler when an error happens', async () => {
    mockHttpService.axiosRef.get = jest.fn().mockImplementationOnce(() => {
      throw new Error();
    });

    await service.getBalances('test', true, true);
    expect(mockHttpErrorHandler.handle).toHaveBeenCalledTimes(1);
  });
});
