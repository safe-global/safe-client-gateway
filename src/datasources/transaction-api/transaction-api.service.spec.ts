import { Balance } from './entities/balance.entity';
import { HttpErrorHandler } from '../errors/http-error-handler';
import { TransactionApi } from './transaction-api.service';
import { Backbone } from '../../chains/entities';
import { mockNetworkService } from '../../common/network/__tests__/test.network.module';

const BALANCES: Balance[] = [
  {
    tokenAddress: 'tokenAddress1',
    balance: BigInt(100),
    token: null,
    fiatBalance: 0,
    fiatConversion: 0,
  },
  {
    tokenAddress: 'tokenAddress2',
    balance: BigInt(100),
    token: null,
    fiatBalance: 0,
    fiatConversion: 0,
  },
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

const mockHttpErrorHandler = {
  handle: jest.fn(),
} as unknown as HttpErrorHandler;

describe('TransactionApi', () => {
  const service: TransactionApi = new TransactionApi(
    'baseUrl',
    mockNetworkService,
    mockHttpErrorHandler,
  );

  it('should return the balances retrieved', async () => {
    mockNetworkService.get.mockResolvedValue({ data: BALANCES });

    const balances = await service.getBalances('test', true, true);
    expect(balances).toBe(BALANCES);
  });

  it('should return the backbone retrieved', async () => {
    mockNetworkService.get.mockResolvedValueOnce({ data: BACKBONE });

    const backbone = await service.getBackbone();
    expect(backbone).toBe(BACKBONE);
  });

  it('should call error handler when an error happens', async () => {
    mockNetworkService.get = jest.fn().mockImplementationOnce(() => {
      throw new Error();
    });

    await service.getBalances('test', true, true);
    expect(mockHttpErrorHandler.handle).toHaveBeenCalledTimes(1);
  });
});
