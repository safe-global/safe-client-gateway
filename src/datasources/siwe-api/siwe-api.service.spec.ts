import { FakeConfigurationService } from '@/config/__tests__/fake.configuration.service';
import { SiweApi } from '@/datasources/siwe-api/siwe-api.service';
import { redisClientFactory } from '@/__tests__/redis-client.factory';
import type { RedisClientType } from '@/datasources/cache/cache.module';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { faker } from '@faker-js/faker';
import type { ILoggingService } from '@/logging/logging.interface';

const mockLoggingService = jest.mocked(
  {} as jest.MockedObjectDeep<ILoggingService>,
);

describe('SiweApiService', () => {
  let service: SiweApi;
  let fakeConfigurationService: FakeConfigurationService;
  let redisClient: RedisClientType;
  let cacheService: ICacheService;
  const expirationTimeInSeconds = faker.number.int();
  const nonceTtlInSeconds = faker.number.int();

  beforeEach(async () => {
    jest.resetAllMocks();
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      expirationTimeInSeconds,
    );
    redisClient = await redisClientFactory();
    cacheService = new RedisCacheService(
      redisClient,
      mockLoggingService,
      fakeConfigurationService,
      '',
    );
    fakeConfigurationService.set('auth.nonceTtlSeconds', nonceTtlInSeconds);
    service = new SiweApi(fakeConfigurationService, cacheService);
  });

  afterEach(async () => {
    await redisClient.quit();
  });

  describe('storeNonce', () => {
    it('should stored the nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);

      await expect(
        cacheService.hGet(new CacheDir(`auth_nonce_${nonce}`, '')),
      ).resolves.toBe(nonce);
    });
  });

  describe('getNonce', () => {
    it('should return the stored nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);
      const expected = await service.getNonce(nonce);

      expect(expected).toBe(nonce);
    });
  });

  describe('clearNonce', () => {
    it('should clear the stored nonce', async () => {
      const nonce = faker.string.alphanumeric();

      await service.storeNonce(nonce);
      await service.clearNonce(nonce);

      await expect(
        cacheService.hGet(new CacheDir(`auth_nonce_${nonce}`, '')),
      ).resolves.toBe(null);
    });
  });
});
