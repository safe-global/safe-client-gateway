// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ClientOfflineError, ErrorReply, MultiErrorReply } from 'redis';
import type { MockedObject } from 'vitest';
import { fakeJson } from '#/__tests__/faker';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { RedisClientType } from '#/datasources/cache/cache.module';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '#/datasources/cache/redis.cache.service';
import { LogType } from '#/domain/common/entities/log-type.entity';
import type { ILoggingService } from '#/logging/logging.interface';

type RedisTransaction = ReturnType<RedisClientType['multi']>;

const transactionMock = {
  hSet: vi.fn(),
  expire: vi.fn(),
  unlink: vi.fn(),
  exec: vi.fn(),
  execAsPipeline: vi.fn(),
} as unknown as MockedObject<RedisTransaction>;

const multiMock = vi.fn();
let isClientReady = true;
let isOfflineQueueDisabled = false;

const redisClientMock = {
  get isReady(): boolean {
    return isClientReady;
  },
  get options(): { disableOfflineQueue: boolean } {
    return { disableOfflineQueue: isOfflineQueueDisabled };
  },
  multi: multiMock,
  hGet: vi.fn(),
  hSet: vi.fn(),
  expire: vi.fn(),
  unlink: vi.fn(),
} as unknown as MockedObject<RedisClientType>;

const mockLoggingService = {
  info: vi.fn(),
  debug: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
} as MockedObject<ILoggingService>;

describe('RedisCacheService', () => {
  let target: RedisCacheService;
  let fakeConfigurationService: FakeConfigurationService;
  let defaultExpirationTimeInSeconds: number;

  beforeEach(() => {
    isClientReady = true;
    isOfflineQueueDisabled = false;
    multiMock.mockReturnValue(transactionMock);
    transactionMock.hSet.mockReturnValue(transactionMock);
    transactionMock.expire.mockReturnValue(transactionMock);
    transactionMock.unlink.mockReturnValue(transactionMock);
    transactionMock.exec.mockResolvedValue([]);
    transactionMock.execAsPipeline.mockResolvedValue([]);

    defaultExpirationTimeInSeconds = faker.number.int({ min: 1, max: 3600 });
    fakeConfigurationService = new FakeConfigurationService();
    fakeConfigurationService.set(
      'expirationTimeInSeconds.default',
      defaultExpirationTimeInSeconds,
    );
    fakeConfigurationService.set(
      'expirationTimeInSeconds.deviatePercent',
      faker.number.int({ min: 1, max: 99 }),
    );

    target = new RedisCacheService(
      redisClientMock,
      mockLoggingService,
      fakeConfigurationService,
      '',
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('hSet', () => {
    it('writes the field and its NX expiry in a single transaction', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.alphanumeric(),
      );
      const value = fakeJson();
      const expireTime = faker.number.int({ min: 1, max: 3600 });

      await target.hSet(cacheDir, value, expireTime, 0);

      expect(multiMock).toHaveBeenCalledOnce();
      expect(transactionMock.hSet).toHaveBeenCalledWith(
        cacheDir.key,
        cacheDir.field,
        value,
      );
      expect(transactionMock.expire).toHaveBeenCalledWith(
        cacheDir.key,
        expireTime,
        'NX',
      );
      expect(transactionMock.exec).toHaveBeenCalledOnce();
      expect(redisClientMock.hSet).not.toHaveBeenCalled();
      expect(redisClientMock.expire).not.toHaveBeenCalled();
    });

    it('does not write when the TTL is not positive', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.alphanumeric(),
      );

      await target.hSet(
        cacheDir,
        fakeJson(),
        faker.number.int({ min: -3600, max: 0 }),
      );

      expect(multiMock).not.toHaveBeenCalled();
    });

    it('logs, unlinks the key and rethrows when the transaction fails', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.alphanumeric(),
      );
      const error = new Error(faker.lorem.sentence());
      transactionMock.exec.mockRejectedValue(error);

      await expect(
        target.hSet(cacheDir, fakeJson(), faker.number.int({ min: 1 }), 0),
      ).rejects.toThrow(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith({
        type: LogType.CacheError,
        source: 'RedisCacheService',
        event: `Error setting/expiring ${cacheDir.key}:${cacheDir.field}`,
      });
      expect(redisClientMock.unlink).toHaveBeenCalledWith(cacheDir.key);
    });

    it('rethrows the failed command error rather than the MultiErrorReply wrapper', async () => {
      const commandError = new ErrorReply(faker.lorem.sentence());
      transactionMock.exec.mockRejectedValue(
        new MultiErrorReply([commandError], [0]),
      );

      await expect(
        target.hSet(
          new CacheDir(
            faker.string.alphanumeric(),
            faker.string.alphanumeric(),
          ),
          fakeJson(),
          faker.number.int({ min: 1, max: 3600 }),
        ),
      ).rejects.toBe(commandError);
    });
  });

  describe('deleteByKey', () => {
    it('unlinks the key and stamps the invalidation marker in a single pipeline', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      const key = faker.string.alphanumeric();
      const unlinkedCount = faker.number.int({ min: 0, max: 1 });
      transactionMock.execAsPipeline.mockResolvedValue([
        unlinkedCount,
        faker.number.int({ min: 0, max: 1 }),
        faker.number.int({ min: 0, max: 1 }),
      ]);

      const result = await target.deleteByKey(key);

      expect(result).toBe(unlinkedCount);
      expect(multiMock).toHaveBeenCalledOnce();
      expect(transactionMock.hSet).toHaveBeenCalledWith(
        `invalidationTimeMs:${key}`,
        '',
        now.toString(),
      );
      expect(transactionMock.expire).toHaveBeenCalledWith(
        `invalidationTimeMs:${key}`,
        defaultExpirationTimeInSeconds,
        'NX',
      );
      expect(transactionMock.unlink).toHaveBeenCalledWith(key);
      expect(transactionMock.unlink).toHaveBeenCalledBefore(
        transactionMock.hSet,
      );
      expect(transactionMock.execAsPipeline).toHaveBeenCalledOnce();
      expect(transactionMock.exec).not.toHaveBeenCalled();
      expect(redisClientMock.unlink).not.toHaveBeenCalled();
      expect(redisClientMock.hSet).not.toHaveBeenCalled();
    });

    it('only unlinks the key when the default TTL is not positive', async () => {
      fakeConfigurationService.set(
        'expirationTimeInSeconds.default',
        faker.number.int({ min: -3600, max: 0 }),
      );
      target = new RedisCacheService(
        redisClientMock,
        mockLoggingService,
        fakeConfigurationService,
        '',
      );
      const key = faker.string.alphanumeric();
      const unlinkedCount = faker.number.int({ min: 0, max: 1 });
      transactionMock.execAsPipeline.mockResolvedValue([unlinkedCount]);

      const result = await target.deleteByKey(key);

      expect(result).toBe(unlinkedCount);
      expect(transactionMock.unlink).toHaveBeenCalledWith(key);
      expect(transactionMock.hSet).not.toHaveBeenCalled();
      expect(transactionMock.expire).not.toHaveBeenCalled();
      expect(transactionMock.execAsPipeline).toHaveBeenCalledOnce();
    });

    it('preserves a concurrent invalidation marker and rethrows the pipeline error', async () => {
      const key = faker.string.alphanumeric();
      const error = new Error(faker.lorem.sentence());
      const failedPipeline = Promise.withResolvers<never>();
      transactionMock.execAsPipeline.mockReturnValueOnce(
        failedPipeline.promise,
      );
      const firstInvalidation = target.deleteByKey(key);
      await target.deleteByKey(key);
      failedPipeline.reject(error);

      await expect(firstInvalidation).rejects.toBe(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith({
        type: LogType.CacheError,
        source: 'RedisCacheService',
        event: `Error deleting ${key} or setting/expiring invalidationTimeMs:${key}`,
      });
      expect(redisClientMock.unlink).not.toHaveBeenCalled();
    });
  });

  describe('with the offline queue disabled', () => {
    beforeEach(() => {
      isOfflineQueueDisabled = true;
    });

    it('hSet fails fast with ClientOfflineError while the client is not ready', async () => {
      isClientReady = false;

      await expect(
        target.hSet(
          new CacheDir(
            faker.string.alphanumeric(),
            faker.string.alphanumeric(),
          ),
          fakeJson(),
          faker.number.int({ min: 1, max: 3600 }),
        ),
      ).rejects.toThrow(ClientOfflineError);

      expect(transactionMock.exec).not.toHaveBeenCalled();
    });

    it('deleteByKey fails fast with ClientOfflineError while the client is not ready', async () => {
      isClientReady = false;

      await expect(
        target.deleteByKey(faker.string.alphanumeric()),
      ).rejects.toThrow(ClientOfflineError);

      expect(transactionMock.execAsPipeline).not.toHaveBeenCalled();
    });

    it('sends the batch while the client is ready', async () => {
      await target.hSet(
        new CacheDir(faker.string.alphanumeric(), faker.string.alphanumeric()),
        fakeJson(),
        faker.number.int({ min: 1, max: 3600 }),
      );

      expect(transactionMock.exec).toHaveBeenCalledOnce();
    });
  });

  describe('with the offline queue enabled', () => {
    it('queues the batch while the client is not ready', async () => {
      isClientReady = false;

      await target.hSet(
        new CacheDir(faker.string.alphanumeric(), faker.string.alphanumeric()),
        fakeJson(),
        faker.number.int({ min: 1, max: 3600 }),
      );

      expect(transactionMock.exec).toHaveBeenCalledOnce();
    });

    it('queues the deleteByKey batch while the client is not ready', async () => {
      isClientReady = false;

      await target.deleteByKey(faker.string.alphanumeric());

      expect(transactionMock.execAsPipeline).toHaveBeenCalledOnce();
    });
  });

  describe('with a key prefix', () => {
    let keyPrefix: string;

    beforeEach(() => {
      keyPrefix = faker.string.uuid();
      target = new RedisCacheService(
        redisClientMock,
        mockLoggingService,
        fakeConfigurationService,
        keyPrefix,
      );
    });

    it('hSet writes the prefixed key', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.sample(),
      );
      const value = fakeJson();
      const expireTime = faker.number.int({ min: 1 });

      await target.hSet(cacheDir, value, expireTime, 0);

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

    it('hGet reads the prefixed key', async () => {
      const cacheDir = new CacheDir(
        faker.string.alphanumeric(),
        faker.string.sample(),
      );

      await target.hGet(cacheDir);

      expect(redisClientMock.hGet).toHaveBeenCalledWith(
        `${keyPrefix}-${cacheDir.key}`,
        cacheDir.field,
      );
    });

    it('deleteByKey unlinks the prefixed key and stamps the prefixed marker', async () => {
      vi.useFakeTimers();
      const now = Date.now();
      const key = faker.string.alphanumeric();

      await target.deleteByKey(key);

      expect(transactionMock.unlink).toHaveBeenCalledWith(
        `${keyPrefix}-${key}`,
      );
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
    });
  });
});
