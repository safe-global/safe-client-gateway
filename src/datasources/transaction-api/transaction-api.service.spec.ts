import { Balance } from './entities/balance.entity';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { TransactionApi } from './transaction-api.service';
import { Backbone } from '../../chains/entities';
import { mockNetworkService } from '../../common/network/__tests__/test.network.module';

const BALANCES: Balance[] = [
  {
    tokenAddress: 'tokenAddress1',
    balance: BigInt(100),
    token: undefined,
    fiatBalance: 0,
    fiatConversion: 0,
  },
  {
    tokenAddress: 'tokenAddress2',
    balance: BigInt(100),
    token: undefined,
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
  settings: {},
};

const mockHttpErrorFactory = {
  from: jest.fn().mockReturnValue(new Error('testErr')),
} as unknown as HttpErrorFactory;

describe('TransactionApi', () => {
  const service: TransactionApi = new TransactionApi(
    'baseUrl',
    mockNetworkService,
    mockHttpErrorFactory,
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

  it('should throw an error when receiving an error from the network service', async () => {
    mockNetworkService.get = jest.fn().mockImplementationOnce(() => {
      throw new Error();
    });

    await expect(service.getBalances('test', true, true)).rejects.toThrow('testErr');

    expect(mockHttpErrorFactory.from).toHaveBeenCalledTimes(1);
  });
});
