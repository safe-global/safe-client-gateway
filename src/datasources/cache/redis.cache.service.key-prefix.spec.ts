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
} as jest.MockedObjectDeep<RedisClientType>;
const redisClientTypeMock = jest.mocked(redisClientType);

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
  const keyPrefix = faker.string.uuid();

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

  it('setting a key should set with prefix', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = fakeJson();
    const expireTime = faker.number.int();

    await redisCacheService.set(cacheDir, value, expireTime);

    expect(redisClientTypeMock.hSet).toHaveBeenCalledWith(
      `${keyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      value,
    );
    expect(redisClientTypeMock.expire).toHaveBeenCalledWith(
      `${keyPrefix}-${cacheDir.key}`,
      expireTime,
      'NX',
    );
  });

  it('getting a key should get with prefix', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    await redisCacheService.get(cacheDir);

    expect(redisClientTypeMock.hGet).toHaveBeenCalledWith(
      `${keyPrefix}-${cacheDir.key}`,
      cacheDir.field,
    );
  });

  it('deleting a key should unlink with prefix', async () => {
    jest.useFakeTimers();
    const now = jest.now();
    const key = faker.string.alphanumeric();

    await redisCacheService.deleteByKey(key);

    expect(redisClientTypeMock.hSet).toHaveBeenCalledWith(
      `${keyPrefix}-invalidationTimeMs:${key}`,
      '',
      now.toString(),
    );
    expect(redisClientTypeMock.expire).toHaveBeenCalledWith(
      `${keyPrefix}-invalidationTimeMs:${key}`,
      defaultExpirationTimeInSeconds,
      'NX',
    );
    jest.useRealTimers();
  });
});
