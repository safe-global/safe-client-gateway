// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { InternalServerErrorException } from '@nestjs/common';
import type postgres from 'postgres';
import type { MaybeRow } from 'postgres';
import type { MockedObject } from 'vitest';
import { fakeJson } from '@/__tests__/faker';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CachedQueryResolver } from '@/datasources/db/v1/cached-query-resolver';
import { LogType } from '@/domain/common/entities/log-type.entity';
import type { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = vi.mocked({
  debug: vi.fn(),
  error: vi.fn(),
} as MockedObject<ILoggingService>);

const mockQuery = vi.mocked({
  execute: vi.fn(),
} as MockedObject<postgres.PendingQuery<Array<MaybeRow>>>);

describe('CachedQueryResolver', () => {
  let fakeCacheService: FakeCacheService;
  let target: CachedQueryResolver;

  beforeAll(() => {
    fakeCacheService = new FakeCacheService();
    target = new CachedQueryResolver(mockLoggingService, fakeCacheService);
  });

  afterEach(() => {
    vi.clearAllMocks();
    fakeCacheService.clear();
  });

  describe('get', () => {
    it('should return the content from cache if it exists', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const value = fakeJson();
      await fakeCacheService.hSet(cacheDir, JSON.stringify(value), ttl);

      const actual = await target.get({
        cacheDir,
        query: mockQuery,
        ttl,
      });

      expect(actual).toBe(value);
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: LogType.CacheHit,
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
        type: LogType.CacheMiss,
        key: 'key',
        field: 'field',
      });
      const cacheContent = await fakeCacheService.hGet(cacheDir);
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
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockLoggingService.error).toHaveBeenCalledWith('error');
    });
  });
});
