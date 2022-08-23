import { RedisCacheService } from './redis.cache.service';
import { RedisClientType } from './cache.module';
import { FakeConfigurationService } from '../config/__tests__/fake.configuration.service';
import { faker } from '@faker-js/faker';
import clearAllMocks = jest.clearAllMocks;

const json = {
  set: jest.fn(),
  del: jest.fn(),
  get: jest.fn(),
} as unknown as any;

const redisClientType = {
  json: json,
  expire: jest.fn(),
  quit: jest.fn(),
} as unknown as RedisClientType;
const redisClientTypeMock = jest.mocked(redisClientType);
const jsonMock = jest.mocked(redisClientTypeMock.json);

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
    const value = faker.datatype.number();

    await redisCacheService.set(key, value, undefined);

    expect(redisClientTypeMock.json.set).toBeCalledTimes(1);
    expect(redisClientTypeMock.json.set).toBeCalledWith(key, '$', value);
    expect(redisClientTypeMock.expire).toBeCalledTimes(1);
    expect(redisClientTypeMock.expire).toBeCalledWith(
      key,
      defaultExpirationTime,
    );
    expect(redisClientTypeMock.json.del).toBeCalledTimes(0);
    expect(redisClientTypeMock.json.get).toBeCalledTimes(0);
  });

  it(`Setting key with expireTimeSeconds`, async () => {
    const key = faker.random.alphaNumeric();
    const value = faker.datatype.number();
    const expireTime = faker.datatype.number();

    await redisCacheService.set(key, value, expireTime);

    expect(redisClientTypeMock.json.set).toBeCalledTimes(1);
    expect(redisClientTypeMock.json.set).toBeCalledWith(key, '$', value);
    expect(redisClientTypeMock.expire).toBeCalledTimes(1);
    expect(redisClientTypeMock.expire).toBeCalledWith(key, expireTime);
    expect(redisClientTypeMock.json.del).toBeCalledTimes(0);
    expect(redisClientTypeMock.json.get).toBeCalledTimes(0);
  });

  it(`Setting key throws on expire`, async () => {
    const key = faker.random.alphaNumeric();
    const value = faker.datatype.number();
    redisClientTypeMock.expire.mockRejectedValueOnce(new Error('cache error'));

    await expect(redisCacheService.set(key, value)).rejects.toThrow(
      'cache error',
    );

    expect(redisClientTypeMock.json.set).toBeCalledTimes(1);
    expect(redisClientTypeMock.json.set).toBeCalledWith(key, '$', value);
    expect(redisClientTypeMock.expire).toBeCalledTimes(1);
    expect(redisClientTypeMock.expire).toBeCalledWith(
      key,
      defaultExpirationTime,
    );
    expect(redisClientTypeMock.json.del).toBeCalledTimes(1);
    expect(redisClientTypeMock.json.del).toBeCalledWith(key, '$');
  });

  it(`Setting key throws on set`, async () => {
    const key = faker.random.alphaNumeric();
    const value = faker.datatype.number();
    jsonMock.set.mockRejectedValueOnce(new Error('cache error'));

    await expect(redisCacheService.set(key, value)).rejects.toThrow(
      'cache error',
    );

    expect(redisClientTypeMock.json.set).toBeCalledTimes(1);
    expect(redisClientTypeMock.json.set).toBeCalledWith(key, '$', value);
    expect(redisClientTypeMock.expire).toBeCalledTimes(0);
    expect(redisClientTypeMock.json.del).toBeCalledTimes(1);
    expect(redisClientTypeMock.json.del).toBeCalledWith(key, '$');
  });

  it(`Getting key calls json.get`, async () => {
    const key = faker.random.alphaNumeric();

    await redisCacheService.get(key);

    expect(redisClientTypeMock.json.get).toBeCalledTimes(1);
    expect(redisClientTypeMock.json.get).toBeCalledWith(key);
    expect(redisClientTypeMock.json.set).toBeCalledTimes(0);
    expect(redisClientTypeMock.json.del).toBeCalledTimes(0);
  });

  it(`When Module gets destroyed, redis connection is closed`, async () => {
    await redisCacheService.onModuleDestroy();

    expect(redisClientTypeMock.json.get).toBeCalledTimes(0);
    expect(redisClientTypeMock.json.set).toBeCalledTimes(0);
    expect(redisClientTypeMock.json.del).toBeCalledTimes(0);
    expect(redisClientTypeMock.quit).toBeCalledTimes(1);
  });
});
