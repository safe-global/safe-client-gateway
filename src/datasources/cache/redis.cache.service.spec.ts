// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import { ClientOfflineError, ErrorReply, MultiErrorReply } from 'redis';
import type { MockedObject } from 'vitest';
import { fakeJson } from '#/__tests__/faker';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { RedisClientType } from '#/datasources/cache/cache.module';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { RedisCacheService } from '#/datasources/cache/redis.cache.service';
import { SET_INVALIDATION_TIME_SCRIPT } from '#/datasources/cache/scripts/set-invalidation-time.script';
import { LogType } from '#/domain/common/entities/log-type.entity';
import type { ILoggingService } from '#/logging/logging.interface';

type RedisTransaction = ReturnType<RedisClientType['multi']>;

const transactionMock = {
  hSet: vi.fn(),
  expire: vi.fn(),
  exec: vi.fn(),
} as unknown as MockedObject<RedisTransaction>;

const multiMock = vi.fn();
const unlinkMock = vi.fn<RedisClientType['unlink']>();
const evalShaMock = vi.fn<RedisClientType['evalSha']>();
const evalMock = vi.fn<RedisClientType['eval']>();
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
  eval: evalMock,
  evalSha: evalShaMock,
  hGet: vi.fn(),
  hSet: vi.fn(),
  expire: vi.fn(),
  unlink: unlinkMock,
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
    transactionMock.exec.mockResolvedValue([]);
    unlinkMock.mockResolvedValue(0);
    evalShaMock.mockResolvedValue(1);
    evalMock.mockResolvedValue(1);

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
      expect(unlinkMock).toHaveBeenCalledWith(cacheDir.key);
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
      unlinkMock.mockResolvedValue(unlinkedCount);

      const result = await target.deleteByKey(key);

      expect(result).toBe(unlinkedCount);
      expect(multiMock).not.toHaveBeenCalled();
      expect(evalShaMock).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{40}$/),
        {
          keys: [`invalidationTimeMs:${key}`],
          arguments: [
            now.toString(),
            defaultExpirationTimeInSeconds.toString(),
          ],
        },
      );
      expect(transactionMock.expire).not.toHaveBeenCalled();
      expect(unlinkMock).toHaveBeenCalledWith(key);
      expect(unlinkMock).toHaveBeenCalledBefore(evalShaMock);
      expect(transactionMock.exec).not.toHaveBeenCalled();
      expect(evalMock).not.toHaveBeenCalled();
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
      unlinkMock.mockResolvedValue(unlinkedCount);

      const result = await target.deleteByKey(key);

      expect(result).toBe(unlinkedCount);
      expect(unlinkMock).toHaveBeenCalledWith(key);
      expect(transactionMock.hSet).not.toHaveBeenCalled();
      expect(evalShaMock).not.toHaveBeenCalled();
      expect(evalMock).not.toHaveBeenCalled();
      expect(transactionMock.expire).not.toHaveBeenCalled();
    });

    it('preserves a concurrent invalidation marker and rethrows a marker write error', async () => {
      const key = faker.string.alphanumeric();
      const error = new Error(faker.lorem.sentence());
      const failedMarkerWrite = Promise.withResolvers<never>();
      evalShaMock.mockReturnValueOnce(failedMarkerWrite.promise);
      const firstInvalidation = target.deleteByKey(key);
      await target.deleteByKey(key);
      failedMarkerWrite.reject(error);

      await expect(firstInvalidation).rejects.toBe(error);

      expect(mockLoggingService.error).toHaveBeenCalledWith({
        type: LogType.CacheError,
        source: 'RedisCacheService',
        event: `Error deleting ${key} or setting/expiring invalidationTimeMs:${key}`,
      });
      expect(unlinkMock.mock.calls).toEqual([[key], [key]]);
      expect(evalMock).not.toHaveBeenCalled();
    });

    it('retries only the marker with the original arguments on NOSCRIPT', async () => {
      const key = faker.string.alphanumeric();
      unlinkMock.mockResolvedValueOnce(1);
      evalShaMock.mockRejectedValueOnce(
        new ErrorReply('NOSCRIPT No matching script. Please use EVAL.'),
      );

      expect(await target.deleteByKey(key)).toBe(1);

      expect(unlinkMock.mock.calls).toEqual([[key]]);
      expect(evalMock).toHaveBeenCalledExactlyOnceWith(
        SET_INVALIDATION_TIME_SCRIPT,
        evalShaMock.mock.calls[0][1],
      );
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

      expect(unlinkMock).not.toHaveBeenCalled();
      expect(evalShaMock).not.toHaveBeenCalled();
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

      expect(unlinkMock).toHaveBeenCalledOnce();
      expect(evalShaMock).toHaveBeenCalledOnce();
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

      expect(unlinkMock).toHaveBeenCalledWith(`${keyPrefix}-${key}`);
      expect(evalShaMock).toHaveBeenCalledWith(
        expect.stringMatching(/^[a-f0-9]{40}$/),
        {
          keys: [`${keyPrefix}-invalidationTimeMs:${key}`],
          arguments: [
            now.toString(),
            defaultExpirationTimeInSeconds.toString(),
          ],
        },
      );
      expect(transactionMock.expire).not.toHaveBeenCalled();
    });
  });
});
