import { Balance } from './entities/balance.entity';
import { TransactionApi } from './transaction-api.service';
import { Backbone } from '../../chains/entities';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';

const BALANCES: Balance[] = [
  {
    tokenAddress: 'tokenAddress1',
    balance: 100,
    token: undefined,
    fiatBalance: 0,
    fiatConversion: 0,
  },
  {
    tokenAddress: 'tokenAddress2',
    balance: 100,
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

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;

const mockDataSource = jest.mocked(dataSource);

describe('TransactionApi', () => {
  const service: TransactionApi = new TransactionApi(
    '1',
    'baseUrl',
    mockDataSource,
  );

  it('should return the balances retrieved', async () => {
    mockDataSource.get.mockResolvedValue(BALANCES);

    const balances = await service.getBalances('test', true, true);

    expect(balances).toBe(BALANCES);
  });

  it('should return the backbone retrieved', async () => {
    mockDataSource.get.mockResolvedValueOnce(BACKBONE);

    const backbone = await service.getBackbone();

    expect(backbone).toBe(BACKBONE);
  });

  it('should forward error', async () => {
    mockDataSource.get = jest
      .fn()
      .mockRejectedValueOnce(new Error('Some error'));

    await expect(service.getBalances('test', true, true)).rejects.toThrow(
      'Some error',
    );

    expect(mockDataSource.get).toHaveBeenCalledTimes(1);
  });
});
