// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '#/config/configuration.service.interface';
import type { ICacheService } from '#/datasources/cache/cache.service.interface';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import type { ILoggingService } from '#/logging/logging.interface';
import type { SafeQueueChange } from '#/modules/safe-queue/domain/entities/safe-queue-change.entity';
import { SafeQueueChangesRepository } from '#/modules/safe-queue/domain/safe-queue-changes.repository';

const mockCacheService = {
  hGet: vi.fn(),
  hSet: vi.fn(),
} as unknown as MockedObject<ICacheService>;

const mockConfigurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const mockLoggingService = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as MockedObject<ILoggingService>;

describe('SafeQueueChangesRepository', () => {
  const changes: Array<SafeQueueChange> = ['transaction_queue', 'messages'];
  const expirationTimeInSeconds = faker.number.int({ min: 1 });
  const chainId = faker.string.numeric();
  const safeAddress = getAddress(faker.finance.ethereumAddress());

  function createRepository(
    safeQueueEnabled: boolean,
  ): SafeQueueChangesRepository {
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'features.safeQueueService') {
        return safeQueueEnabled;
      }
      if (key === 'expirationTimeInSeconds.default') {
        return expirationTimeInSeconds;
      }
      throw new Error(`Unexpected key: ${key}`);
    });
    return new SafeQueueChangesRepository(
      mockCacheService,
      mockConfigurationService,
      mockLoggingService,
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getChangedAt', () => {
    it.each(changes)('should read when the %s changed', async (change) => {
      const changedAt = faker.date.recent();
      mockCacheService.hGet.mockResolvedValue(changedAt.toISOString());

      await expect(
        createRepository(true).getChangedAt({ change, chainId, safeAddress }),
      ).resolves.toEqual(changedAt);
      expect(mockCacheService.hGet).toHaveBeenCalledExactlyOnceWith(
        new CacheDir(
          `${chainId}_safe_queue_${change}_changed_at_${safeAddress}`,
          '',
        ),
      );
    });

    it('should return null when no change was recorded', async () => {
      mockCacheService.hGet.mockResolvedValue(null);

      await expect(
        createRepository(true).getChangedAt({
          change: faker.helpers.arrayElement(changes),
          chainId,
          safeAddress,
        }),
      ).resolves.toBeNull();
    });

    it('should return null and warn when the recorded value is not a date', async () => {
      const change = faker.helpers.arrayElement(changes);
      mockCacheService.hGet.mockResolvedValue(faker.word.sample());

      await expect(
        createRepository(true).getChangedAt({ change, chainId, safeAddress }),
      ).resolves.toBeNull();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          `Failed to read when the ${change} changed. chainId=${chainId}, safeAddress=${safeAddress}`,
        ),
      );
    });

    it('should return null and warn when the read fails', async () => {
      const change = faker.helpers.arrayElement(changes);
      const error = new Error(faker.lorem.sentence());
      mockCacheService.hGet.mockRejectedValue(error);

      await expect(
        createRepository(true).getChangedAt({ change, chainId, safeAddress }),
      ).resolves.toBeNull();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        `Failed to read when the ${change} changed. chainId=${chainId}, safeAddress=${safeAddress}, error=${error.message}`,
      );
    });

    it('should return null without reading when FF_SAFE_QUEUE_SERVICE is off', async () => {
      await expect(
        createRepository(false).getChangedAt({
          change: faker.helpers.arrayElement(changes),
          chainId,
          safeAddress,
        }),
      ).resolves.toBeNull();
      expect(mockCacheService.hGet).not.toHaveBeenCalled();
    });
  });

  describe('setChangedAt', () => {
    it.each(changes)(
      'should store when the %s changed for the default cache TTL',
      async (change) => {
        const changedAt = faker.date.recent();

        await createRepository(true).setChangedAt({
          change,
          chainId,
          safeAddress,
          changedAt,
        });

        expect(mockCacheService.hSet).toHaveBeenCalledExactlyOnceWith(
          new CacheDir(
            `${chainId}_safe_queue_${change}_changed_at_${safeAddress}`,
            '',
          ),
          changedAt.toISOString(),
          expirationTimeInSeconds,
        );
      },
    );

    it('should resolve and warn when the write fails', async () => {
      const change = faker.helpers.arrayElement(changes);
      const error = new Error(faker.lorem.sentence());
      mockCacheService.hSet.mockRejectedValue(error);

      await expect(
        createRepository(true).setChangedAt({
          change,
          chainId,
          safeAddress,
          changedAt: faker.date.recent(),
        }),
      ).resolves.toBeUndefined();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        `Failed to record when the ${change} changed. chainId=${chainId}, safeAddress=${safeAddress}, error=${error.message}`,
      );
    });

    it('should not store anything when FF_SAFE_QUEUE_SERVICE is off', async () => {
      await createRepository(false).setChangedAt({
        change: faker.helpers.arrayElement(changes),
        chainId,
        safeAddress,
        changedAt: faker.date.recent(),
      });

      expect(mockCacheService.hSet).not.toHaveBeenCalled();
    });
  });
});
