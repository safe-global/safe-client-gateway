import { faker } from '@faker-js/faker';
import { IConfigurationService } from '@/config/configuration.service.interface';
import { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import { INetworkService } from '@/datasources/network/network.service.interface';
import { TransactionApi } from '@/datasources/transaction-api/transaction-api.service';
import { backboneBuilder } from '@/domain/backbone/entities/__tests__/backbone.builder';
import { balanceBuilder } from '@/domain/balances/entities/__tests__/balance.builder';
import { DataSourceError } from '@/domain/errors/data-source.error';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';

const dataSource = {
  get: jest.fn(),
} as unknown as CacheFirstDataSource;
const mockDataSource = jest.mocked(dataSource);

const cacheService = {
  deleteByKey: jest.fn(),
} as unknown as ICacheService;
const mockCacheService = jest.mocked(cacheService);

const configurationService = {
  getOrThrow: jest.fn(),
} as unknown as IConfigurationService;
const mockConfigurationService = jest.mocked(configurationService);

const httpErrorFactory = {
  from: jest.fn(),
} as unknown as HttpErrorFactory;
const mockHttpErrorFactory = jest.mocked(httpErrorFactory);

const networkService = jest.mocked({
  post: jest.fn(),
}) as unknown as INetworkService;

describe('TransactionApi', () => {
  const chainId = '1';
  const baseUrl = faker.internet.url({ appendSlash: false });
  let service: TransactionApi;
  let defaultExpirationTimeInSeconds: number;
  let notFoundExpireTimeSeconds: number;

  beforeEach(() => {
    jest.clearAllMocks();

    defaultExpirationTimeInSeconds = faker.number.int();
    notFoundExpireTimeSeconds = faker.number.int();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') {
        return defaultExpirationTimeInSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.default') {
        return notFoundExpireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.contract') {
        return notFoundExpireTimeSeconds;
      }
      if (key === 'expirationTimeInSeconds.notFound.token') {
        return notFoundExpireTimeSeconds;
      }
      throw Error(`Unexpected key: ${key}`);
    });

    service = new TransactionApi(
      chainId,
      baseUrl,
      mockDataSource,
      mockCacheService,
      mockConfigurationService,
      mockHttpErrorFactory,
      networkService,
    );
  });

  describe('Balances', () => {
    it('should return the balances retrieved', async () => {
      const data = [balanceBuilder().build(), balanceBuilder().build()];
      mockDataSource.get.mockResolvedValue(data);

      const actual = await service.getBalances({
        safeAddress: 'test',
        trusted: true,
        excludeSpam: true,
      });

      expect(actual).toBe(data);
      expect(mockHttpErrorFactory.from).toHaveBeenCalledTimes(0);
    });

    it('should forward error', async () => {
      const expected = new DataSourceError('something happened');
      mockDataSource.get.mockRejectedValueOnce(new Error('Some error'));
      mockHttpErrorFactory.from.mockReturnValue(expected);

      await expect(
        service.getBalances({
          safeAddress: 'test',
          trusted: true,
          excludeSpam: true,
        }),
      ).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockHttpErrorFactory.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('Backbone', () => {
    it('should return the backbone retrieved', async () => {
      const data = backboneBuilder().build();
      mockDataSource.get.mockResolvedValueOnce(data);

      const actual = await service.getBackbone();

      expect(actual).toBe(data);
      expect(mockHttpErrorFactory.from).toHaveBeenCalledTimes(0);
    });

    it('should forward error', async () => {
      const expected = new DataSourceError('something happened');
      mockHttpErrorFactory.from.mockReturnValue(expected);
      mockDataSource.get.mockRejectedValueOnce(new Error('testErr'));

      await expect(service.getBackbone()).rejects.toThrow(expected);

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      expect(mockHttpErrorFactory.from).toHaveBeenCalledTimes(1);
    });
  });

  describe('Clear Local Balances', () => {
    it('should call delete', async () => {
      const safeAddress = faker.finance.ethereumAddress();
      mockCacheService.deleteByKey.mockResolvedValueOnce(1);

      await service.clearLocalBalances(safeAddress);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(2);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_balances_${safeAddress}`,
      );
      expect(mockHttpErrorFactory.from).toHaveBeenCalledTimes(0);
    });
  });

  describe('Safe', () => {
    it('should return retrieved safe', async () => {
      const safe = safeBuilder().build();
      mockDataSource.get.mockResolvedValueOnce(safe);

      const actual = await service.getSafe(safe.address);

      expect(actual).toBe(safe);
      expect(mockDataSource.get).toHaveBeenCalledWith({
        cacheDir: new CacheDir(`${chainId}_safe_${safe.address}`, ''),
        url: `${baseUrl}/api/v1/safes/${safe.address}`,
        notFoundExpireTimeSeconds: notFoundExpireTimeSeconds,
        expireTimeSeconds: defaultExpirationTimeInSeconds,
      });
      expect(httpErrorFactory.from).toHaveBeenCalledTimes(0);
    });

    it('should map error on error', async () => {
      const safe = safeBuilder().build();
      const error = new Error('some error');
      const expected = new DataSourceError('some data source error');
      mockDataSource.get.mockRejectedValueOnce(error);
      mockHttpErrorFactory.from.mockReturnValue(expected);

      await expect(service.getSafe(safe.address)).rejects.toThrow(expected);
      expect(httpErrorFactory.from).toHaveBeenCalledTimes(1);
    });
  });
});
