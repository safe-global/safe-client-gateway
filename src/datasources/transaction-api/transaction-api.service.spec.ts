import { TransactionApi } from './transaction-api.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import backboneFactory from '../../domain/balances/entities/__tests__/backbone.factory';
import { Backbone } from '../../domain/backbone/entities/backbone.entity';
import { Balance } from '../../domain/balances/entities/balance.entity';
import { balanceFactory } from '../../domain/balances/entities/__tests__/balance.factory';
import { ICacheService } from '../cache/cache.service.interface';
import { faker } from '@faker-js/faker';

const BALANCES: Balance[] = [balanceFactory(), balanceFactory()];
const BACKBONE: Backbone = backboneFactory();

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;
const mockDataSource = jest.mocked(dataSource);

const cacheService = {
  delete: jest.fn(),
} as unknown as ICacheService;
const mockCacheService = jest.mocked(cacheService);

describe('TransactionApi', () => {
  const service: TransactionApi = new TransactionApi(
    '1',
    'baseUrl',
    mockDataSource,
    mockCacheService,
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

  describe('Clear Local Balances', () => {
    it('should call delete', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      mockCacheService.delete.mockResolvedValueOnce(1);

      await service.clearLocalBalances(safeAddress);

      expect(mockCacheService.delete).toBeCalledTimes(1);
      expect(mockCacheService.delete).toBeCalledWith(
        `1_${safeAddress}_balances`,
      );
    });
  });
});
