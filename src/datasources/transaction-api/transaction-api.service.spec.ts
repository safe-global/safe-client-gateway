import { TransactionApi } from './transaction-api.service';
import { CacheFirstDataSource } from '../cache/cache.first.data.source';
import backboneFactory from '../../domain/balances/entities/__tests__/backbone.factory';
import { balanceFactory } from '../../domain/balances/entities/__tests__/balance.factory';
import { ICacheService } from '../cache/cache.service.interface';
import { faker } from '@faker-js/faker';
import { HttpErrorFactory } from '../errors/http-error-factory';
import { DataSourceError } from '../../domain/errors/data-source.error';

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;
const mockDataSource = jest.mocked(dataSource);

const cacheService = {
  delete: jest.fn(),
} as unknown as ICacheService;
const mockCacheService = jest.mocked(cacheService);

const httpErrorFactory = {
  from: jest.fn(),
} as unknown as HttpErrorFactory;
const mockHttpErrorFactory = jest.mocked(httpErrorFactory);

describe('TransactionApi', () => {
  const service: TransactionApi = new TransactionApi(
    '1',
    'baseUrl',
    mockDataSource,
    mockCacheService,
    mockHttpErrorFactory,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Balances', () => {
    it('should return the balances retrieved', async () => {
      const data = [balanceFactory(), balanceFactory()];
      mockDataSource.get.mockResolvedValue(data);

      const actual = await service.getBalances('test', true, true);

      expect(actual).toBe(data);
      expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
    });

    it('should forward error', async () => {
      const expected = new DataSourceError('something happened');
      mockDataSource.get.mockRejectedValueOnce(new Error('Some error'));
      mockHttpErrorFactory.from.mockReturnValue(expected);

      await expect(
        service.getBalances('test', true, true),
      ).rejects.toThrowError(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockHttpErrorFactory.from).toBeCalledTimes(1);
    });
  });

  describe('Backbone', () => {
    it('should return the backbone retrieved', async () => {
      const data = backboneFactory();
      mockDataSource.get.mockResolvedValueOnce(data);

      const actual = await service.getBackbone();

      expect(actual).toBe(data);
      expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
    });

    it('should forward error', async () => {
      const expected = new DataSourceError('something happened');
      mockHttpErrorFactory.from.mockReturnValue(expected);
      mockDataSource.get.mockRejectedValueOnce(new Error('testErr'));

      await expect(service.getBackbone()).rejects.toThrowError(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockHttpErrorFactory.from).toBeCalledTimes(1);
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
      expect(mockHttpErrorFactory.from).toBeCalledTimes(0);
    });
  });
});
