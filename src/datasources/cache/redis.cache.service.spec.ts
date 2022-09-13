import { RedisCacheService } from './redis.cache.service';
import { RedisClientType } from './cache.module';
import { FakeConfigurationService } from '../../common/config/__tests__/fake.configuration.service';
import { faker } from '@faker-js/faker';
import clearAllMocks = jest.clearAllMocks;

const redisClientType = {
  hGet: jest.fn(),
  hSet: jest.fn(),
  hDel: jest.fn(),
  expire: jest.fn(),
  quit: jest.fn(),
} as unknown as RedisClientType;
const redisClientTypeMock = jest.mocked(redisClientType);

describe('RedisCacheService', () => {
  let redisCacheService: RedisCacheService;
  const configurationService = new FakeConfigurationService();
  const defaultExpirationTime = 10;

  beforeAll(async () => {
    configurationService.set(
      'expirationTimeInSeconds.default',
      defaultExpirationTime,
    );
  });

  beforeEach(async () => {
    clearAllMocks();
    redisCacheService = new RedisCacheService(
      redisClientTypeMock,
      configurationService,
    );
  });

  it(`Setting key without setting expireTimeSeconds`, async () => {
    const key = faker.random.alphaNumeric();
    const field = faker.datatype.string();
    const value = faker.datatype.json();

    await redisCacheService.set(key, field, value, undefined);

    expect(redisClientTypeMock.hSet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hSet).toBeCalledWith(key, field, value);
    expect(redisClientTypeMock.expire).toBeCalledTimes(1);
    expect(redisClientTypeMock.expire).toBeCalledWith(
      key,
      defaultExpirationTime,
    );
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.hGet).toBeCalledTimes(0);
  });

  it(`Setting key with expireTimeSeconds`, async () => {
    const key = faker.random.alphaNumeric();
    const field = faker.datatype.string();
    const value = faker.datatype.json();
    const expireTime = faker.datatype.number();

    await redisCacheService.set(key, field, value, expireTime);

    expect(redisClientTypeMock.hSet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hSet).toBeCalledWith(key, field, value);
    expect(redisClientTypeMock.expire).toBeCalledTimes(1);
    expect(redisClientTypeMock.expire).toBeCalledWith(key, expireTime);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.hGet).toBeCalledTimes(0);
  });

  it(`Setting key throws on expire`, async () => {
    const key = faker.random.alphaNumeric();
    const field = faker.datatype.string();
    const value = faker.datatype.json();
    redisClientTypeMock.expire.mockRejectedValueOnce(new Error('cache error'));

    await expect(redisCacheService.set(key, field, value)).rejects.toThrow(
      'cache error',
    );

    expect(redisClientTypeMock.hSet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hSet).toBeCalledWith(key, field, value);
    expect(redisClientTypeMock.expire).toBeCalledTimes(1);
    expect(redisClientTypeMock.expire).toBeCalledWith(
      key,
      defaultExpirationTime,
    );
    expect(redisClientTypeMock.hDel).toBeCalledTimes(1);
    expect(redisClientTypeMock.hDel).toBeCalledWith(key, field);
  });

  it(`Setting key throws on set`, async () => {
    const key = faker.random.alphaNumeric();
    const field = faker.datatype.string();
    const value = faker.datatype.json();
    redisClientTypeMock.hSet.mockRejectedValueOnce(new Error('cache error'));

    await expect(redisCacheService.set(key, field, value)).rejects.toThrow(
      'cache error',
    );

    expect(redisClientTypeMock.hSet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hSet).toBeCalledWith(key, field, value);
    expect(redisClientTypeMock.expire).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(1);
    expect(redisClientTypeMock.hDel).toBeCalledWith(key, field);
  });

  it(`Getting key calls json.get`, async () => {
    const key = faker.random.alphaNumeric();
    const field = faker.datatype.string();

    await redisCacheService.get(key, field);

    expect(redisClientTypeMock.hGet).toBeCalledTimes(1);
    expect(redisClientTypeMock.hGet).toBeCalledWith(key, field);
    expect(redisClientTypeMock.hSet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
  });

  it(`When Module gets destroyed, redis connection is closed`, async () => {
    await redisCacheService.onModuleDestroy();

    expect(redisClientTypeMock.hGet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hSet).toBeCalledTimes(0);
    expect(redisClientTypeMock.hDel).toBeCalledTimes(0);
    expect(redisClientTypeMock.quit).toBeCalledTimes(1);
  });
});
