// SPDX-License-Identifier: FSL-1.1-MIT

import { beforeEach, describe, expect, it, jest } from 'bun:test';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { type MockedObject, mocked } from '#/__tests__/mocks';
import { CacheRouter } from '#/datasources/cache/cache.router';
import type { ICacheService } from '#/datasources/cache/cache.service.interface';
import { LogType } from '#/domain/common/entities/log-type.entity';
import type { ILoggingService } from '#/logging/logging.interface';
import { TransactionEventType } from '#/modules/hooks/routes/entities/event-type.entity';
import { ZerionCacheService } from '#/modules/zerion/datasources/zerion-cache.service';

const mockCacheService = mocked({
  deleteByKey: jest.fn(),
} as MockedObject<ICacheService>);

const mockLoggingService = {
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
} as MockedObject<ILoggingService>;

describe('ZerionCacheService', () => {
  let service: ZerionCacheService;
  const address = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ZerionCacheService(mockCacheService, mockLoggingService);
  });

  describe('invalidate', () => {
    it('clears the wallet-portfolio, portfolio, and positions caches', async () => {
      await service.invalidate(address, TransactionEventType.INCOMING_TOKEN);

      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        CacheRouter.getZerionWalletPortfolioCacheKey({ address }),
      );
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        CacheRouter.getPortfolioCacheKey({ address }),
      );
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        CacheRouter.getZerionPositionsCacheKey({ safeAddress: address }),
      );
    });

    it('logs the invalidation with its source', async () => {
      await service.invalidate(address, 'refresh');

      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: LogType.ZerionCacheInvalidated,
        address,
        source: 'refresh',
      });
    });

    it('is best-effort: a failed delete is logged, the rest proceed, nothing throws', async () => {
      mockCacheService.deleteByKey
        .mockRejectedValueOnce(new Error('redis down'))
        .mockResolvedValue(1);

      await expect(
        service.invalidate(address, 'refresh'),
      ).resolves.toBeUndefined();

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(3);
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(1);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('redis down'),
      );
    });
  });
});
