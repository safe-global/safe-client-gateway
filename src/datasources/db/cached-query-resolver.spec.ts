import { fakeJson } from '@/__tests__/faker';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CachedQueryResolver } from '@/datasources/db/cached-query-resolver';
import { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import postgres, { MaybeRow } from 'postgres';

const mockLoggingService = jest.mocked({
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>);

const mockQuery = jest.mocked({ catch: jest.fn() } as jest.MockedObjectDeep<
  postgres.PendingQuery<MaybeRow[]>
>);

describe('CachedQueryResolver', () => {
  let fakeCacheService: FakeCacheService;
  let target: CachedQueryResolver;

  beforeAll(() => {
    fakeCacheService = new FakeCacheService();
    target = new CachedQueryResolver(mockLoggingService, fakeCacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    fakeCacheService.clear();
  });

  describe('get', () => {
    it('should return the content from cache if it exists', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const value = fakeJson();
      await fakeCacheService.set(cacheDir, JSON.stringify(value), ttl);

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
      expect(mockQuery.catch).not.toHaveBeenCalled();
    });

    it('should execute the query and cache the result if the cache is empty', async () => {
      const cacheDir = { key: 'key', field: 'field' };
      const ttl = faker.number.int({ min: 1, max: 1000 });
      const dbResult = { ...JSON.parse(fakeJson()), count: 1 };
      mockQuery.catch.mockResolvedValue(dbResult);

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
      const cacheContent = await fakeCacheService.get(cacheDir);
      expect(cacheContent).toBe(JSON.stringify(dbResult));
    });
  });
});
