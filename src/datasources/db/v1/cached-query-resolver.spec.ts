import { fakeJson } from '@/__tests__/faker';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import type { RedisClientType } from '@/datasources/cache/cache.module';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { InternalServerErrorException } from '@nestjs/common';
import type { MaybeRow } from 'postgres';
import type postgres from 'postgres';

const mockLoggingService = jest.mocked({
  debug: jest.fn(),
  error: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockQuery = jest.mocked({
  execute: jest.fn(),
} as jest.MockedObjectDeep<postgres.PendingQuery<Array<MaybeRow>>>);

describe('CachedQueryResolver', () => {
  let redisClient: RedisClientType;
  let cacheService: ICacheService;
  let target: CachedQueryResolver;

  beforeAll(async () => {
    redisClient = await redisClientFactory();
    const fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      faker.number.int(),
    );
    cacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      fakeConfigurationService,
      '',
    );
    target = new CachedQueryResolver(mockLoggingService, cacheService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    await redisClient.flushAll();
  });

  afterAll(async () => {
    await redisClient.quit();
  });

  describe('get', () => {
    it('should return the content from cache if it exists', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const value = fakeJson();
      await cacheService.hSet(cacheDir, JSON.stringify(value), ttl);

      const actual = await target.get({
        cacheDir,
        query: mockQuery,
        ttl,
      });

      expect(actual).toBe(value);
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'cache_hit',
        key: 'key',
        field: 'field',
      });
    });

    it('should execute the query and cache the result if the cache is empty', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const dbResult = { ...JSON.parse(fakeJson()), count: 1 };
      mockQuery.execute.mockImplementation(() => dbResult);

      const actual = await target.get({
        cacheDir,
        query: mockQuery,
        ttl,
      });

      expect(actual).toBe(dbResult);
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'cache_miss',
        key: 'key',
        field: 'field',
      });
      const cacheContent = await cacheService.hGet(cacheDir);
      expect(cacheContent).toBe(JSON.stringify(dbResult));
    });

    it('should log the error and throw a generic error if the query fails', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const error = new Error('error');
      mockQuery.execute.mockRejectedValue(error);

      await expect(
        target.get({
          cacheDir,
          query: mockQuery,
          ttl,
        }),
      ).rejects.toThrow(
        new InternalServerErrorException('Internal Server Error'),
      );

      expect(mockLoggingService.error).toHaveBeenCalledWith('error');
    });
  });
});
