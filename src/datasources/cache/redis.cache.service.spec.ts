import { faker } from '@faker-js/faker';
import { ILoggingService } from '@/logging/logging.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '@/datasources/cache/redis.cache.service';
import { RedisClientType } from 'redis';
import { fakeJson } from '@/__tests__/faker';
import { IConfigurationService } from '@/config/configuration.service.interface';
import clearAllMocks = jest.clearAllMocks;

const redisClientType = {
  hGet: jest.fn(),
  hSet: jest.fn(),
  hDel: jest.fn(),
  expire: jest.fn(),
  unlink: jest.fn(),
  quit: jest.fn(),
  scanIterator: jest.fn(),
} as unknown as RedisClientType;
const redisClientTypeMock = jest.mocked(redisClientType);

const mockLoggingService = {
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
} as unknown as ILoggingService;

const configurationService = {
  getOrThrow: jest.fn(),
} as unknown as IConfigurationService;
const mockConfigurationService = jest.mocked(configurationService);

describe('RedisCacheService', () => {
  let redisCacheService: RedisCacheService;
  let defaultExpirationTimeInSeconds: number;
  const keyPrefix = '';

  beforeEach(async () => {
    clearAllMocks();
    defaultExpirationTimeInSeconds = faker.number.int();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'expirationTimeInSeconds.default') {
        return defaultExpirationTimeInSeconds;
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

  it('Setting key without setting expireTimeSeconds', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();

    await redisCacheService.set(cacheDir, value, undefined);

    expect(redisClientTypeMock.hSet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.expire).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hDel).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hGet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.quit).toHaveBeenCalledTimes(0);
  });

  it('Setting key with expireTimeSeconds', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    const expireTime = faker.number.int();

    await redisCacheService.set(cacheDir, value, expireTime);

    expect(redisClientTypeMock.hSet).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.hSet).toHaveBeenCalledWith(
      cacheDir.key,
      cacheDir.field,
      value,
    );
    expect(redisClientTypeMock.expire).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.expire).toHaveBeenCalledWith(
      cacheDir.key,
      expireTime,
    );
    expect(redisClientTypeMock.hDel).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hGet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.quit).toHaveBeenCalledTimes(0);
  });

  it('Setting key throws on expire', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    const expireTimeSeconds = faker.number.int({ min: 5 });
    redisClientTypeMock.expire.mockRejectedValueOnce(new Error('cache error'));

    await expect(
      redisCacheService.set(cacheDir, value, expireTimeSeconds),
    ).rejects.toThrow('cache error');

    expect(redisClientTypeMock.hSet).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.hSet).toHaveBeenCalledWith(
      cacheDir.key,
      cacheDir.field,
      value,
    );
    expect(redisClientTypeMock.expire).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.expire).toHaveBeenCalledWith(
      cacheDir.key,
      expireTimeSeconds,
    );
    expect(redisClientTypeMock.hDel).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.hDel).toHaveBeenCalledWith(
      cacheDir.key,
      cacheDir.field,
    );
    expect(redisClientTypeMock.quit).toHaveBeenCalledTimes(0);
  });

  it('Setting key throws on set', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    redisClientTypeMock.hSet.mockRejectedValueOnce(new Error('cache error'));

    await expect(
      redisCacheService.set(cacheDir, value, faker.number.int({ min: 5 })),
    ).rejects.toThrow('cache error');

    expect(redisClientTypeMock.hSet).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.hSet).toHaveBeenCalledWith(
      cacheDir.key,
      cacheDir.field,
      value,
    );
    expect(redisClientTypeMock.expire).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hDel).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.hDel).toHaveBeenCalledWith(
      cacheDir.key,
      cacheDir.field,
    );
    expect(redisClientTypeMock.quit).toHaveBeenCalledTimes(0);
  });

  it('Getting key calls hGet', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    await redisCacheService.get(cacheDir);

    expect(redisClientTypeMock.hGet).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.hGet).toHaveBeenCalledWith(
      cacheDir.key,
      cacheDir.field,
    );
    expect(redisClientTypeMock.hSet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hDel).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.quit).toHaveBeenCalledTimes(0);
  });

  it('Deleting key calls delete and sets invalidationTime', async () => {
    jest.useFakeTimers();
    const now = jest.now();
    const key = faker.string.alphanumeric();

    await redisCacheService.deleteByKey(key);

    expect(redisClientTypeMock.unlink).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.hGet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hSet).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.hSet).toHaveBeenCalledWith(
      `invalidationTimeMs:${key}`,
      '',
      now.toString(),
    );
    expect(redisClientTypeMock.expire).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.expire).toHaveBeenCalledWith(
      `invalidationTimeMs:${key}`,
      defaultExpirationTimeInSeconds,
    );
    expect(redisClientTypeMock.hDel).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.quit).toHaveBeenCalledTimes(0);
    jest.useRealTimers();
  });

  it('Deleting keys by pattern calls scan and unlink', async () => {
    const matches = [
      faker.string.alphanumeric(),
      faker.string.alphanumeric(),
      faker.string.alphanumeric(),
    ];
    redisClientTypeMock.scanIterator = jest.fn().mockReturnValue(matches);

    await redisCacheService.deleteByKeyPattern(faker.string.alphanumeric());

    expect(redisClientTypeMock.scanIterator).toHaveBeenCalledTimes(1);
    expect(redisClientTypeMock.unlink).toHaveBeenCalledTimes(matches.length);
    expect(redisClientTypeMock.hGet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hSet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hDel).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.quit).toHaveBeenCalledTimes(0);
  });

  it('When Module gets destroyed, redis connection is closed', async () => {
    await redisCacheService.onModuleDestroy();

    expect(redisClientTypeMock.hGet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hSet).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.hDel).toHaveBeenCalledTimes(0);
    expect(redisClientTypeMock.quit).toHaveBeenCalledTimes(1);
  });
});
