// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { MockedObject } from 'vitest';
import { fakeJson } from '#/__tests__/faker';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import type { RedisClientType } from '#/datasources/cache/cache.module';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '#/datasources/cache/redis.cache.service';
import type { ILoggingService } from '#/logging/logging.interface';

const transactionMock = {
  hSet: vi.fn(),
  expire: vi.fn(),
  unlink: vi.fn(),
  exec: vi.fn(),
} as unknown as MockedObject<ReturnType<RedisClientType['multi']>>;

const multiMock = vi.fn();

const redisClientTypeMock = {
  isReady: true,
  multi: multiMock,
  hGet: vi.fn(),
  hSet: vi.fn(),
  hDel: vi.fn(),
  expire: vi.fn(),
  unlink: vi.fn(),
  quit: vi.fn(),
  scanIterator: vi.fn(),
} as unknown as MockedObject<RedisClientType>;

const mockLoggingService: MockedObject<ILoggingService> = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
};

const configurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;
const mockConfigurationService = vi.mocked(configurationService);

describe('RedisCacheService with a Key Prefix', () => {
  let redisCacheService: RedisCacheService;
  let defaultExpirationTimeInSeconds: number;
  let defaultExpirationDeviatePercent: number;
  const keyPrefix = faker.string.uuid();

  beforeEach(() => {
    vi.clearAllMocks();
    multiMock.mockReturnValue(transactionMock);
    transactionMock.hSet.mockReturnValue(transactionMock);
    transactionMock.expire.mockReturnValue(transactionMock);
    transactionMock.unlink.mockReturnValue(transactionMock);
    transactionMock.exec.mockResolvedValue([]);
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

    expect(transactionMock.hSet).toHaveBeenCalledWith(
      `${keyPrefix}-${cacheDir.key}`,
      cacheDir.field,
      value,
    );
    expect(transactionMock.expire).toHaveBeenCalledWith(
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
    await redisCacheService.hGet(cacheDir);

    expect(redisClientTypeMock.hGet).toHaveBeenCalledWith(
      `${keyPrefix}-${cacheDir.key}`,
      cacheDir.field,
    );
  });

  it('deleting a key should unlink with prefix', async () => {
    vi.useFakeTimers();
    const now = Date.now();
    const key = faker.string.alphanumeric();

    await redisCacheService.deleteByKey(key);

    expect(transactionMock.unlink).toHaveBeenCalledWith(`${keyPrefix}-${key}`);
    expect(transactionMock.hSet).toHaveBeenCalledWith(
      `${keyPrefix}-invalidationTimeMs:${key}`,
      '',
      now.toString(),
    );
    expect(transactionMock.expire).toHaveBeenCalledWith(
      `${keyPrefix}-invalidationTimeMs:${key}`,
      defaultExpirationTimeInSeconds,
      'NX',
    );
    vi.useRealTimers();
  });
});
