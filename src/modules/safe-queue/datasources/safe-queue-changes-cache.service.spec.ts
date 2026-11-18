// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { FakeConfigurationService } from '#/config/__tests__/fake.configuration.service';
import type { ICacheService } from '#/datasources/cache/cache.service.interface';
import { CacheDir } from '#/datasources/cache/entities/cache-dir.entity';
import { SafeQueueChangesCacheService } from '#/modules/safe-queue/datasources/safe-queue-changes-cache.service';
import { SafeQueueChanges } from '#/modules/safe-queue/domain/entities/safe-queue-change.entity';

const mockCacheService = {
  hGet: vi.fn(),
  hSet: vi.fn(),
} as unknown as MockedObject<ICacheService>;

describe('SafeQueueChangesCacheService', () => {
  const expirationTimeInSeconds = faker.number.int({ min: 1 });
  const chainId = faker.string.numeric();
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  let service: SafeQueueChangesCacheService;

  beforeEach(() => {
    vi.resetAllMocks();
    const configurationService = new FakeConfigurationService();
    configurationService.set(
      'expirationTimeInSeconds.default',
      expirationTimeInSeconds,
    );
    service = new SafeQueueChangesCacheService(
      mockCacheService,
      configurationService,
    );
  });

  describe('getChangedAt', () => {
    it.each(SafeQueueChanges)(
      'should read the safe_queue_changed_at cache key of the %s',
      async (change) => {
        const changedAt = faker.date.recent().toISOString();
        mockCacheService.hGet.mockResolvedValue(changedAt);

        await expect(
          service.getChangedAt({ change, chainId, safeAddress }),
        ).resolves.toBe(changedAt);
        expect(mockCacheService.hGet).toHaveBeenCalledExactlyOnceWith(
          new CacheDir(
            `${chainId}_safe_queue_changed_at_${change}_${safeAddress}`,
            '',
          ),
        );
      },
    );

    it('should return null when no change was stored', async () => {
      mockCacheService.hGet.mockResolvedValue(null);

      await expect(
        service.getChangedAt({
          change: faker.helpers.arrayElement(SafeQueueChanges),
          chainId,
          safeAddress,
        }),
      ).resolves.toBeNull();
    });
  });

  describe('setChangedAt', () => {
    it.each(SafeQueueChanges)(
      'should store when the %s changed for the default cache TTL',
      async (change) => {
        const changedAt = faker.date.recent();

        await service.setChangedAt({ change, chainId, safeAddress, changedAt });

        expect(mockCacheService.hSet).toHaveBeenCalledExactlyOnceWith(
          new CacheDir(
            `${chainId}_safe_queue_changed_at_${change}_${safeAddress}`,
            '',
          ),
          changedAt.toISOString(),
          expirationTimeInSeconds,
        );
      },
    );
  });
});
