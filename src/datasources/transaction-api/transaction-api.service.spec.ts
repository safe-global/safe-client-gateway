import { TransactionApi } from './transaction-api.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import { Backbone } from '../../domain/backbone/entities/backbone.entity';
import backboneFactory from '../../domain/balances/entities/__tests__/backbone.factory';
import { Balance } from '../../domain/balances/entities/balance.entity';
import { balanceFactory } from '../../domain/balances/entities/__tests__/balance.factory';

const BALANCES: Balance[] = [balanceFactory(), balanceFactory()];
const BACKBONE: Backbone = backboneFactory();

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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Balances', () => {
    it('should return the balances retrieved', async () => {
      mockDataSource.get.mockResolvedValue(BALANCES);
      const balances = await service.getBalances('test', true, true);
      expect(balances).toBe(BALANCES);
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

  describe('Backbone', () => {
    it('should return the backbone retrieved', async () => {
      mockDataSource.get.mockResolvedValueOnce(BACKBONE);
      const backbone = await service.getBackbone();
      expect(backbone).toBe(BACKBONE);
    });

    it('should forward error', async () => {
      const err = new Error('testErr');
      mockDataSource.get = jest.fn().mockRejectedValueOnce(err);
      await expect(service.getBackbone()).rejects.toThrow(err.message);
      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
    });
  });
});
