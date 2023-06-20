import { faker } from '@faker-js/faker';
import { ILoggingService } from '../../logging/logging.interface';
import { RedisClientType } from './cache.module';
import { CacheDir } from './entities/cache-dir.entity';
import { RedisCacheService } from './redis.cache.service';
import { FakeConfigurationService } from '../../config/__tests__/fake.configuration.service';
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

describe('RedisCacheService', () => {
  let redisCacheService: RedisCacheService;
  const configurationService = new FakeConfigurationService();

  beforeEach(async () => {
    clearAllMocks();
    redisCacheService = new RedisCacheService(
      redisClientTypeMock,
      configurationService,
      mockLoggingService,
    );
  });

  it('Setting key without setting expireTimeSeconds', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = faker.datatype.json();

    await redisCacheService.set(cacheDir, value, undefined);

    expect(redisClientTypeMock.hSet).toBeCalledTimes(0);
    expect(redisClientTypeMock.expire).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.hGet).toBeCalledTimes(0);
    expect(redisClientTypeMock.quit).toBeCalledTimes(0);
  });

  it('Setting key with expireTimeSeconds', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = faker.datatype.json();
    const expireTime = faker.number.int();

    await redisCacheService.set(cacheDir, value, expireTime);

    expect(redisClientTypeMock.hSet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hSet).toBeCalledWith(
      cacheDir.key,
      cacheDir.field,
      value,
    );
    expect(redisClientTypeMock.expire).toBeCalledTimes(1);
    expect(redisClientTypeMock.expire).toBeCalledWith(cacheDir.key, expireTime);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.hGet).toBeCalledTimes(0);
    expect(redisClientTypeMock.quit).toBeCalledTimes(0);
  });

  it('Setting key throws on expire', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = faker.datatype.json();
    const expireTimeSeconds = faker.number.int({ min: 5 });
    redisClientTypeMock.expire.mockRejectedValueOnce(new Error('cache error'));

    await expect(
      redisCacheService.set(cacheDir, value, expireTimeSeconds),
    ).rejects.toThrow('cache error');

    expect(redisClientTypeMock.hSet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hSet).toBeCalledWith(
      cacheDir.key,
      cacheDir.field,
      value,
    );
    expect(redisClientTypeMock.expire).toBeCalledTimes(1);
    expect(redisClientTypeMock.expire).toBeCalledWith(
      cacheDir.key,
      expireTimeSeconds,
    );
    expect(redisClientTypeMock.hDel).toBeCalledTimes(1);
    expect(redisClientTypeMock.hDel).toBeCalledWith(
      cacheDir.key,
      cacheDir.field,
    );
    expect(redisClientTypeMock.quit).toBeCalledTimes(0);
  });

  it('Setting key throws on set', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    const value = faker.datatype.json();
    redisClientTypeMock.hSet.mockRejectedValueOnce(new Error('cache error'));

    await expect(
      redisCacheService.set(cacheDir, value, faker.number.int({ min: 5 })),
    ).rejects.toThrow('cache error');

    expect(redisClientTypeMock.hSet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hSet).toBeCalledWith(
      cacheDir.key,
      cacheDir.field,
      value,
    );
    expect(redisClientTypeMock.expire).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(1);
    expect(redisClientTypeMock.hDel).toBeCalledWith(
      cacheDir.key,
      cacheDir.field,
    );
    expect(redisClientTypeMock.quit).toBeCalledTimes(0);
  });

  it('Getting key calls hGet', async () => {
    const cacheDir = new CacheDir(
      faker.string.alphanumeric(),
      faker.string.sample(),
    );
    await redisCacheService.get(cacheDir);

    expect(redisClientTypeMock.hGet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hGet).toBeCalledWith(
      cacheDir.key,
      cacheDir.field,
    );
    expect(redisClientTypeMock.hSet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.quit).toBeCalledTimes(0);
  });

  it('Deleting key calls delete', async () => {
    const key = faker.string.alphanumeric();

    await redisCacheService.deleteByKey(key);

    expect(redisClientTypeMock.unlink).toBeCalledTimes(1);
    expect(redisClientTypeMock.hGet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hSet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.quit).toBeCalledTimes(0);
  });

  it('Deleting keys by pattern calls scan and unlink', async () => {
    const matches = [
      faker.string.alphanumeric(),
      faker.string.alphanumeric(),
      faker.string.alphanumeric(),
    ];
    redisClientTypeMock.scanIterator = jest.fn().mockReturnValue(matches);

    await redisCacheService.deleteByKeyPattern(faker.string.alphanumeric());

    expect(redisClientTypeMock.scanIterator).toBeCalledTimes(1);
    expect(redisClientTypeMock.unlink).toBeCalledTimes(matches.length);
    expect(redisClientTypeMock.hGet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hSet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.quit).toBeCalledTimes(0);
  });

  it('When Module gets destroyed, redis connection is closed', async () => {
    await redisCacheService.onModuleDestroy();

    expect(redisClientTypeMock.hGet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hSet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.quit).toBeCalledTimes(1);
  });
});
