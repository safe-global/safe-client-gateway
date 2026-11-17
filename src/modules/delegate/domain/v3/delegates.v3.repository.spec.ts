// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { pageBuilder } from '#/domain/entities/__tests__/page.builder';
import type { ITransactionApi } from '#/domain/interfaces/transaction-api.interface';
import type { ITransactionApiManager } from '#/domain/interfaces/transaction-api.manager.interface';
import type { ILoggingService } from '#/logging/logging.interface';
import { DelegatesV3Repository } from '#/modules/delegate/domain/v3/delegates.v3.repository';
import { safeQueueDelegateBuilder } from '#/modules/safe-queue/entities/__tests__/safe-queue-delegate.builder';
import type { SafeQueueDelegate } from '#/modules/safe-queue/entities/delegate.entity';
import type { ISafeQueueService } from '#/modules/safe-queue/safe-queue.interface';
import { rawify } from '#/validation/entities/raw.entity';

const mockTransactionApiManager = {
  getApi: vi.fn(),
} as MockedObject<ITransactionApiManager>;

const mockTransactionApi = {
  clearDelegates: vi.fn(),
} as MockedObject<ITransactionApi>;

const mockSafeQueueService = {
  getDelegates: vi.fn(),
  postDelegate: vi.fn(),
  updateDelegate: vi.fn(),
  deleteDelegate: vi.fn(),
  clearDelegates: vi.fn(),
} as MockedObject<ISafeQueueService>;

const mockLoggingService = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

describe('DelegatesV3Repository', () => {
  let repository: DelegatesV3Repository;

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    mockTransactionApi.clearDelegates.mockResolvedValue(undefined);
    mockSafeQueueService.clearDelegates.mockResolvedValue(undefined);
    repository = new DelegatesV3Repository(
      mockTransactionApiManager,
      mockSafeQueueService,
      mockLoggingService,
    );
  });

  describe('getDelegates', () => {
    it('uses the queue service and maps results to the domain shape', async () => {
      const chainId = faker.string.numeric();
      const safe = getAddress(faker.finance.ethereumAddress());
      const delegate = getAddress(faker.finance.ethereumAddress());
      const delegator = getAddress(faker.finance.ethereumAddress());
      const queueDelegate = {
        delegate,
        delegator,
        chainId,
        safe,
        label: null,
        created: faker.date.recent().toISOString(),
        modified: faker.date.recent().toISOString(),
      };
      const page = pageBuilder<SafeQueueDelegate>()
        .with('results', [queueDelegate as unknown as SafeQueueDelegate])
        .with('count', 1)
        .build();
      mockSafeQueueService.getDelegates.mockResolvedValue(
        rawify(page) as never,
      );

      const result = await repository.getDelegates({
        chainId,
        safeAddress: safe,
      });

      expect(mockSafeQueueService.getDelegates).toHaveBeenCalledTimes(1);
      expect(mockSafeQueueService.getDelegates).toHaveBeenCalledWith({
        chainId,
        safeAddress: safe,
      });
      expect(mockTransactionApiManager.getApi).not.toHaveBeenCalled();
      expect(result.results).toStrictEqual([
        {
          safe,
          delegate,
          delegator,
          // null label from the queue is normalized to an empty string
          label: '',
        },
      ]);
    });

    it('passes a null safe through unchanged', async () => {
      const chainId = faker.string.numeric();
      const delegate = getAddress(faker.finance.ethereumAddress());
      const delegator = getAddress(faker.finance.ethereumAddress());
      const queueDelegate = {
        delegate,
        delegator,
        chainId,
        safe: null,
        label: faker.word.sample(),
        created: faker.date.recent().toISOString(),
        modified: faker.date.recent().toISOString(),
      };
      const page = pageBuilder<SafeQueueDelegate>()
        .with('results', [queueDelegate as unknown as SafeQueueDelegate])
        .with('count', 1)
        .build();
      mockSafeQueueService.getDelegates.mockResolvedValue(
        rawify(page) as never,
      );

      const result = await repository.getDelegates({ chainId });

      expect(result.results[0].safe).toBeNull();
      expect(result.results[0].label).toBe(queueDelegate.label);
    });

    it('accepts a delegate with a null chainId', async () => {
      const chainId = faker.string.numeric();
      const queueDelegates = [
        safeQueueDelegateBuilder().with('chainId', null).build(),
        safeQueueDelegateBuilder().with('chainId', chainId).build(),
      ];
      const page = pageBuilder<SafeQueueDelegate>()
        .with('results', queueDelegates)
        .with('count', queueDelegates.length)
        .build();
      mockSafeQueueService.getDelegates.mockResolvedValue(rawify(page));

      const result = await repository.getDelegates({ chainId });

      expect(result.results).toStrictEqual(
        queueDelegates.map((delegate) => ({
          safe: delegate.safe,
          delegate: delegate.delegate,
          delegator: delegate.delegator,
          label: delegate.label,
        })),
      );
    });
  });

  describe('postDelegate', () => {
    it('uses the queue service and invalidates both cache layers', async () => {
      const args = {
        chainId: faker.string.numeric(),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
        delegate: getAddress(faker.finance.ethereumAddress()),
        delegator: getAddress(faker.finance.ethereumAddress()),
        signature: faker.string.hexadecimal(),
        label: faker.word.sample(),
      };

      await repository.postDelegate(args);

      expect(mockSafeQueueService.postDelegate).toHaveBeenCalledTimes(1);
      expect(mockSafeQueueService.postDelegate).toHaveBeenCalledWith(args);

      // fire-and-forget cache invalidation — both layers are cleared since
      // they are independent caches (see DelegatesV3Repository.clearDelegates)
      await new Promise(setImmediate);
      expect(mockSafeQueueService.clearDelegates).toHaveBeenCalledTimes(1);
      expect(mockSafeQueueService.clearDelegates).toHaveBeenCalledWith({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      });
      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledTimes(1);
      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledWith(
        args.safeAddress,
      );
    });
  });

  describe('updateDelegate', () => {
    it('uses the queue service and invalidates both cache layers', async () => {
      const args = {
        chainId: faker.string.numeric(),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
        delegate: getAddress(faker.finance.ethereumAddress()),
        delegator: getAddress(faker.finance.ethereumAddress()),
        signature: faker.string.hexadecimal(),
        label: faker.word.sample(),
      };

      await repository.updateDelegate(args);

      expect(mockSafeQueueService.updateDelegate).toHaveBeenCalledTimes(1);
      expect(mockSafeQueueService.updateDelegate).toHaveBeenCalledWith(args);

      await new Promise(setImmediate);
      expect(mockSafeQueueService.clearDelegates).toHaveBeenCalledTimes(1);
      expect(mockSafeQueueService.clearDelegates).toHaveBeenCalledWith({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      });
      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledTimes(1);
      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledWith(
        args.safeAddress,
      );
    });
  });

  describe('deleteDelegate', () => {
    it('uses the queue service and invalidates both cache layers', async () => {
      const args = {
        chainId: faker.string.numeric(),
        safeAddress: getAddress(faker.finance.ethereumAddress()),
        delegate: getAddress(faker.finance.ethereumAddress()),
        delegator: getAddress(faker.finance.ethereumAddress()),
        signature: faker.string.hexadecimal(),
      };

      await repository.deleteDelegate(args);

      expect(mockSafeQueueService.deleteDelegate).toHaveBeenCalledTimes(1);
      expect(mockSafeQueueService.deleteDelegate).toHaveBeenCalledWith(args);

      await new Promise(setImmediate);
      expect(mockSafeQueueService.clearDelegates).toHaveBeenCalledTimes(1);
      expect(mockSafeQueueService.clearDelegates).toHaveBeenCalledWith({
        chainId: args.chainId,
        safeAddress: args.safeAddress,
      });
      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledTimes(1);
      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledWith(
        args.safeAddress,
      );
    });

    it('handles a null safeAddress when invalidating cache', async () => {
      const args = {
        chainId: faker.string.numeric(),
        safeAddress: null as Address | null,
        delegate: getAddress(faker.finance.ethereumAddress()),
        delegator: getAddress(faker.finance.ethereumAddress()),
        signature: faker.string.hexadecimal(),
      };

      await repository.deleteDelegate(args);

      await new Promise(setImmediate);
      expect(mockSafeQueueService.clearDelegates).toHaveBeenCalledWith({
        chainId: args.chainId,
        safeAddress: undefined,
      });
      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledWith(undefined);
    });
  });

  describe('clearDelegates', () => {
    it('clears both the tx-service and queue caches, even though only the v1/v2 endpoints read the tx-service layer', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await repository.clearDelegates({ chainId, safeAddress });

      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledWith(
        safeAddress,
      );
      expect(mockSafeQueueService.clearDelegates).toHaveBeenCalledWith({
        chainId,
        safeAddress,
      });
    });

    it('swallows a failure in either layer, clears the other, and logs a warning', async () => {
      const chainId = faker.string.numeric();
      const safeAddress = getAddress(faker.finance.ethereumAddress());
      mockSafeQueueService.clearDelegates.mockRejectedValueOnce(
        new Error('queue unavailable'),
      );

      await expect(
        repository.clearDelegates({ chainId, safeAddress }),
      ).resolves.toBeUndefined();

      expect(mockTransactionApi.clearDelegates).toHaveBeenCalledWith(
        safeAddress,
      );
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to clear queue delegates cache'),
      );
    });
  });
});
