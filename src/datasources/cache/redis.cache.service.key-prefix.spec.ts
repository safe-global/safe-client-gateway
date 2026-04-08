// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import type { ILoggingService } from '@/logging/logging.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import type { RedisClientType } from '@/datasources/cache/cache.module';
import { fakeJson } from '@/__tests__/faker';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import clearAllMocks = jest.clearAllMocks;

const multiMock = {
  hSet: jest.fn().mockReturnThis(),
  expire: jest.fn().mockReturnThis(),
  unlink: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([]),
};

const redisClientTypeMock = {
  isReady: true,
  hGet: jest.fn(),
  hSet: jest.fn(),
  hDel: jest.fn(),
  expire: jest.fn(),
  unlink: jest.fn(),
  quit: jest.fn(),
  scanIterator: jest.fn(),
  multi: jest.fn().mockReturnValue(multiMock),
} as unknown as jest.MockedObjectDeep<RedisClientType>;

const mockLoggingService: jest.MockedObjectDeep<ILoggingService> = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
};

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

describe('RedisCacheService with a Key Prefix', () => {
  let redisCacheService: RedisCacheService;
  let defaultExpirationTimeInSeconds: number;
  let defaultExpirationDeviatePercent: number;
  const keyPrefix = faker.string.uuid();

  beforeEach(() => {
    clearAllMocks();
    defaultExpirationTimeInSeconds = faker.number.int({ min: 1, max: 3600 });
    defaultExpirationDeviatePercent = faker.number.int({ min: 1, max: 3600 });
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') {
        return defaultExpirationTimeInSeconds;
      }
      if (key === 'expirationTimeInSeconds.deviatePercent') {
        return defaultExpirationDeviatePercent;
      }
      throw Error(`Unexpected key: ${key}`);
    });

    redisCacheService = new RedisCacheService(
      redisClientTypeMock,
      mockLoggingService,
      mockConfigurationService,
      keyPrefix,
    );
  });

  it('setting a key should set with prefix', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    const expireTime = faker.number.int();

    await redisCacheService.hSet(cacheDir, value, expireTime, 0);

    expect(redisClientTypeMock.multi).toHaveBeenCalled();
    expect(multiMock.hSet).toHaveBeenCalledWith(
      `${keyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      value,
    );
    expect(multiMock.expire).toHaveBeenCalledWith(
      `${keyPrefix}-${cacheDir.key}`,
      expireTime,
      'NX',
    );
    expect(multiMock.exec).toHaveBeenCalled();
  });

  it('getting a key should get with prefix', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    await redisCacheService.hGet(cacheDir);

    expect(redisClientTypeMock.hGet).toHaveBeenCalledWith(
      `${keyPrefix}-${cacheDir.key}`,
      cacheDir.field,
    );
  });

  it('deleting a key should unlink with prefix', async () => {
    jest.useFakeTimers();
    const now = jest.now();
    const key = faker.string.alphanumeric();
    multiMock.exec.mockResolvedValueOnce([1, 1, 1]);

    await redisCacheService.deleteByKey(key);

    expect(redisClientTypeMock.multi).toHaveBeenCalled();
    expect(multiMock.unlink).toHaveBeenCalledWith(`${keyPrefix}-${key}`);
    expect(multiMock.hSet).toHaveBeenCalledWith(
      `${keyPrefix}-invalidationTimeMs:${key}`,
      '',
      now.toString(),
    );
    expect(multiMock.expire).toHaveBeenCalledWith(
      `${keyPrefix}-invalidationTimeMs:${key}`,
      defaultExpirationTimeInSeconds,
      'NX',
    );
    expect(multiMock.exec).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('deleteByKey should return 0 if the pipeline unlink result is not a number', async () => {
    multiMock.exec.mockResolvedValueOnce([new Error('Pipeline error'), 1, 1]);

    const result = await redisCacheService.deleteByKey(
      faker.string.alphanumeric(),
    );

    expect(result).toBe(0);
  });

  it('deleteByKey should throw if invalidation marker pipeline replies are invalid', async () => {
    const key = faker.string.alphanumeric();
    multiMock.exec.mockResolvedValueOnce([1, new Error('Pipeline error'), 1]);

    await expect(redisCacheService.deleteByKey(key)).rejects.toThrow(
      `Invalidation marker failed for key "${key}"`,
    );
  });
});
