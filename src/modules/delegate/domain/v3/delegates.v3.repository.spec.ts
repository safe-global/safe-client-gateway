// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import { DelegatePageSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';
import { DelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository';
import type { SafeQueueDelegate } from '@/modules/safe-queue/entities/delegate.entity';
import type { ISafeQueueService } from '@/modules/safe-queue/safe-queue.interface';
import { rawify } from '@/validation/entities/raw.entity';

const mockTransactionApiManager = {
  getApi: vi.fn(),
} as MockedObject<ITransactionApiManager>;

const mockTransactionApi = {
  getDelegatesV2: vi.fn(),
  postDelegateV2: vi.fn(),
  updateDelegateV2: vi.fn(),
  deleteDelegateV2: vi.fn(),
  clearDelegates: vi.fn(),
} as MockedObject<ITransactionApi>;

const mockSafeQueueService = {
  getDelegates: vi.fn(),
  postDelegate: vi.fn(),
  updateDelegate: vi.fn(),
  deleteDelegate: vi.fn(),
  clearDelegates: vi.fn(),
} as MockedObject<ISafeQueueService>;

const mockConfigurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const mockLoggingService = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

describe('DelegatesV3Repository', () => {
  let repository: DelegatesV3Repository;

  function createRepository(opts: {
    safeQueueEnabled: boolean;
  }): DelegatesV3Repository {
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'features.safeQueueService') {
        return opts.safeQueueEnabled;
      }
      throw new Error(`Unexpected key: ${key}`);
    });
    return new DelegatesV3Repository(
      mockTransactionApiManager,
      mockSafeQueueService,
      mockConfigurationService,
      mockLoggingService,
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    mockTransactionApi.clearDelegates.mockResolvedValue(undefined);
    mockSafeQueueService.clearDelegates.mockResolvedValue(undefined);
  });

  describe('safeQueueService disabled (flag OFF)', () => {
    beforeEach(() => {
      repository = createRepository({ safeQueueEnabled: false });
    });

    describe('getDelegates', () => {
      it('uses the transaction service and returns parsed delegates', async () => {
        const chainId = faker.string.numeric();
        const safeAddress = getAddress(faker.finance.ethereumAddress());
        const delegates = [
          delegateBuilder().build(),
          delegateBuilder().build(),
        ];
        const page = pageBuilder()
          .with('results', delegates)
          .with('count', delegates.length)
          .build();
        mockTransactionApi.getDelegatesV2.mockResolvedValue(rawify(page));

        const result = await repository.getDelegates({ chainId, safeAddress });

        expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(chainId);
        expect(mockTransactionApi.getDelegatesV2).toHaveBeenCalledTimes(1);
        expect(mockSafeQueueService.getDelegates).not.toHaveBeenCalled();
        expect(result).toStrictEqual(DelegatePageSchema.parse(page));
      });
    });

    describe('postDelegate', () => {
      it('uses the transaction service and not the queue service', async () => {
        const args = {
          chainId: faker.string.numeric(),
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          delegate: getAddress(faker.finance.ethereumAddress()),
          delegator: getAddress(faker.finance.ethereumAddress()),
          signature: faker.string.hexadecimal(),
          label: faker.word.sample(),
        };

        await repository.postDelegate(args);

        expect(mockTransactionApi.postDelegateV2).toHaveBeenCalledTimes(1);
        expect(mockTransactionApi.postDelegateV2).toHaveBeenCalledWith({
          safeAddress: args.safeAddress,
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          label: args.label,
        });
        expect(mockSafeQueueService.postDelegate).not.toHaveBeenCalled();
      });
    });

    describe('updateDelegate', () => {
      it('uses the transaction service and not the queue service', async () => {
        const args = {
          chainId: faker.string.numeric(),
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          delegate: getAddress(faker.finance.ethereumAddress()),
          delegator: getAddress(faker.finance.ethereumAddress()),
          signature: faker.string.hexadecimal(),
          label: faker.word.sample(),
        };

        await repository.updateDelegate(args);

        expect(mockTransactionApi.updateDelegateV2).toHaveBeenCalledTimes(1);
        expect(mockTransactionApi.updateDelegateV2).toHaveBeenCalledWith({
          safeAddress: args.safeAddress,
          delegate: args.delegate,
          delegator: args.delegator,
          signature: args.signature,
          label: args.label,
        });
        expect(mockSafeQueueService.updateDelegate).not.toHaveBeenCalled();
      });
    });

    describe('deleteDelegate', () => {
      it('uses the transaction service and not the queue service', async () => {
        const args = {
          chainId: faker.string.numeric(),
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          delegate: getAddress(faker.finance.ethereumAddress()),
          delegator: getAddress(faker.finance.ethereumAddress()),
          signature: faker.string.hexadecimal(),
        };

        await repository.deleteDelegate(args);

        expect(mockTransactionApi.deleteDelegateV2).toHaveBeenCalledTimes(1);
        expect(mockTransactionApi.deleteDelegateV2).toHaveBeenCalledWith({
          delegate: args.delegate,
          delegator: args.delegator,
          safeAddress: args.safeAddress,
          signature: args.signature,
        });
        expect(mockSafeQueueService.deleteDelegate).not.toHaveBeenCalled();
      });
    });
  });

  describe('safeQueueService enabled (flag ON)', () => {
    beforeEach(() => {
      repository = createRepository({ safeQueueEnabled: true });
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
        mockSafeQueueService.getDelegates.mockResolvedValue(rawify(page) as never);

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
        mockSafeQueueService.getDelegates.mockResolvedValue(rawify(page) as never);

        const result = await repository.getDelegates({ chainId });

        expect(result.results[0].safe).toBeNull();
        expect(result.results[0].label).toBe(queueDelegate.label);
      });
    });

    describe('postDelegate', () => {
      it('uses the queue service, not the tx-service, and invalidates cache', async () => {
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
        expect(mockTransactionApi.postDelegateV2).not.toHaveBeenCalled();

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
      it('uses the queue service, not the tx-service, and invalidates both cache layers', async () => {
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
        expect(mockTransactionApi.updateDelegateV2).not.toHaveBeenCalled();

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
      it('uses the queue service, not the tx-service, and invalidates both cache layers', async () => {
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
        expect(mockTransactionApi.deleteDelegateV2).not.toHaveBeenCalled();

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
        expect(mockTransactionApi.clearDelegates).toHaveBeenCalledWith(
          undefined,
        );
      });
    });
  });

  describe('clearDelegates', () => {
    it('clears both the tx-service and queue caches, independent of the flag', async () => {
      repository = createRepository({ safeQueueEnabled: false });
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
      repository = createRepository({ safeQueueEnabled: false });
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
