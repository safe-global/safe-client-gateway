// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { ILoggingService } from '#/logging/logging.interface';
import type { ISafeQueueChangesCacheService } from '#/modules/safe-queue/datasources/safe-queue-changes-cache.service.interface';
import { SafeQueueChanges } from '#/modules/safe-queue/domain/entities/safe-queue-change.entity';
import { SafeQueueChangesRepository } from '#/modules/safe-queue/domain/safe-queue-changes.repository';
import { rawify } from '#/validation/entities/raw.entity';

const mockSafeQueueChangesCacheService = {
  getChangedAt: vi.fn(),
  setChangedAt: vi.fn(),
} as MockedObject<ISafeQueueChangesCacheService>;

const mockLoggingService = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as MockedObject<ILoggingService>;

describe('SafeQueueChangesRepository', () => {
  const chainId = faker.string.numeric();
  const safeAddress = getAddress(faker.finance.ethereumAddress());

  function createRepository(
    safeQueueEnabled: boolean,
  ): SafeQueueChangesRepository {
    const configurationService = new FakeConfigurationService();
    configurationService.set('features.safeQueueService', safeQueueEnabled);
    return new SafeQueueChangesRepository(
      mockSafeQueueChangesCacheService,
      configurationService,
      mockLoggingService,
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getChangedAt', () => {
    it.each(SafeQueueChanges)(
      'should read when the %s changed',
      async (change) => {
        const changedAt = faker.date.recent();
        mockSafeQueueChangesCacheService.getChangedAt.mockResolvedValue(
          rawify(changedAt.toISOString()),
        );

        await expect(
          createRepository(true).getChangedAt({ change, chainId, safeAddress }),
        ).resolves.toEqual(changedAt);
        expect(
          mockSafeQueueChangesCacheService.getChangedAt,
        ).toHaveBeenCalledExactlyOnceWith({ change, chainId, safeAddress });
      },
    );

    it('should return null when no change was recorded', async () => {
      mockSafeQueueChangesCacheService.getChangedAt.mockResolvedValue(null);

      await expect(
        createRepository(true).getChangedAt({
          change: faker.helpers.arrayElement(SafeQueueChanges),
          chainId,
          safeAddress,
        }),
      ).resolves.toBeNull();
    });

    it('should return null and warn when the recorded value is not a date', async () => {
      const change = faker.helpers.arrayElement(SafeQueueChanges);
      mockSafeQueueChangesCacheService.getChangedAt.mockResolvedValue(
        rawify(faker.word.sample()),
      );

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
      const change = faker.helpers.arrayElement(SafeQueueChanges);
      const error = new Error(faker.lorem.sentence());
      mockSafeQueueChangesCacheService.getChangedAt.mockRejectedValue(error);

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
          change: faker.helpers.arrayElement(SafeQueueChanges),
          chainId,
          safeAddress,
        }),
      ).resolves.toBeNull();
      expect(
        mockSafeQueueChangesCacheService.getChangedAt,
      ).not.toHaveBeenCalled();
    });
  });

  describe('setChangedAt', () => {
    it.each(SafeQueueChanges)(
      'should store when the %s changed',
      async (change) => {
        const changedAt = faker.date.recent();

        await createRepository(true).setChangedAt({
          change,
          chainId,
          safeAddress,
          changedAt,
        });

        expect(
          mockSafeQueueChangesCacheService.setChangedAt,
        ).toHaveBeenCalledExactlyOnceWith({
          change,
          chainId,
          safeAddress,
          changedAt,
        });
      },
    );

    it.each([
      ['later', faker.number.int({ min: 1, max: 60_000 })],
      ['the same', 0],
    ])(
      'should store one second after the stored time when it is %s',
      async (_, msLater) => {
        const change = faker.helpers.arrayElement(SafeQueueChanges);
        const changedAt = faker.date.recent();
        const storedChangedAt = new Date(changedAt.getTime() + msLater);
        mockSafeQueueChangesCacheService.getChangedAt.mockResolvedValue(
          rawify(storedChangedAt.toISOString()),
        );

        await createRepository(true).setChangedAt({
          change,
          chainId,
          safeAddress,
          changedAt,
        });

        expect(
          mockSafeQueueChangesCacheService.setChangedAt,
        ).toHaveBeenCalledExactlyOnceWith({
          change,
          chainId,
          safeAddress,
          changedAt: new Date(storedChangedAt.getTime() + 1_000),
        });
      },
    );

    it('should replace an older stored time', async () => {
      const change = faker.helpers.arrayElement(SafeQueueChanges);
      const changedAt = faker.date.recent();
      mockSafeQueueChangesCacheService.getChangedAt.mockResolvedValue(
        rawify(faker.date.past({ refDate: changedAt }).toISOString()),
      );

      await createRepository(true).setChangedAt({
        change,
        chainId,
        safeAddress,
        changedAt,
      });

      expect(
        mockSafeQueueChangesCacheService.setChangedAt,
      ).toHaveBeenCalledExactlyOnceWith({
        change,
        chainId,
        safeAddress,
        changedAt,
      });
    });

    it('should store the time when the stored one cannot be read', async () => {
      mockSafeQueueChangesCacheService.getChangedAt.mockRejectedValue(
        new Error(faker.lorem.sentence()),
      );

      await createRepository(true).setChangedAt({
        change: faker.helpers.arrayElement(SafeQueueChanges),
        chainId,
        safeAddress,
        changedAt: faker.date.recent(),
      });

      expect(mockSafeQueueChangesCacheService.setChangedAt).toHaveBeenCalled();
    });

    it('should resolve and warn when the write fails', async () => {
      const change = faker.helpers.arrayElement(SafeQueueChanges);
      const error = new Error(faker.lorem.sentence());
      mockSafeQueueChangesCacheService.setChangedAt.mockRejectedValue(error);

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
        change: faker.helpers.arrayElement(SafeQueueChanges),
        chainId,
        safeAddress,
        changedAt: faker.date.recent(),
      });

      expect(
        mockSafeQueueChangesCacheService.setChangedAt,
      ).not.toHaveBeenCalled();
    });
  });
});
