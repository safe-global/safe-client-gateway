// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import { DelegatePageSchema } from '@/modules/delegate/domain/entities/schemas/delegate.schema';
import { DelegatesV3Repository } from '@/modules/delegate/domain/v3/delegates.v3.repository';
import type { QueueDelegate } from '@/modules/queue/entities/delegate.entity';
import type { IQueue } from '@/modules/queue/queue.interface';
import { rawify } from '@/validation/entities/raw.entity';

const mockTransactionApiManager = {
  getApi: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApiManager>;

const mockTransactionApi = {
  getDelegatesV2: jest.fn(),
  postDelegateV2: jest.fn(),
  updateDelegateV2: jest.fn(),
  deleteDelegateV2: jest.fn(),
  clearDelegates: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApi>;

const mockQueueService = {
  getDelegates: jest.fn(),
  postDelegate: jest.fn(),
  updateDelegate: jest.fn(),
  deleteDelegate: jest.fn(),
  clearDelegates: jest.fn(),
} as jest.MockedObjectDeep<IQueue>;

const mockConfigurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

const mockLoggingService = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('DelegatesV3Repository', () => {
  let repository: DelegatesV3Repository;

  function createRepository(opts: {
    queueServiceEnabled: boolean;
  }): DelegatesV3Repository {
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'features.queueService') {
        return opts.queueServiceEnabled;
      }
      throw new Error(`Unexpected key: ${key}`);
    });
    return new DelegatesV3Repository(
      mockTransactionApiManager,
      mockQueueService,
      mockConfigurationService,
      mockLoggingService,
    );
  }

  beforeEach(() => {
    jest.resetAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
  });

  describe('queueService disabled (flag OFF)', () => {
    beforeEach(() => {
      repository = createRepository({ queueServiceEnabled: false });
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
        expect(mockQueueService.getDelegates).not.toHaveBeenCalled();
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
        expect(mockQueueService.postDelegate).not.toHaveBeenCalled();
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
        expect(mockQueueService.updateDelegate).not.toHaveBeenCalled();
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
        expect(mockQueueService.deleteDelegate).not.toHaveBeenCalled();
      });
    });
  });

  describe('queueService enabled (flag ON)', () => {
    beforeEach(() => {
      repository = createRepository({ queueServiceEnabled: true });
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
        const page = pageBuilder<QueueDelegate>()
          .with('results', [queueDelegate as unknown as QueueDelegate])
          .with('count', 1)
          .build();
        mockQueueService.getDelegates.mockResolvedValue(rawify(page) as never);

        const result = await repository.getDelegates({
          chainId,
          safeAddress: safe,
        });

        expect(mockQueueService.getDelegates).toHaveBeenCalledTimes(1);
        expect(mockQueueService.getDelegates).toHaveBeenCalledWith({
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
        const page = pageBuilder<QueueDelegate>()
          .with('results', [queueDelegate as unknown as QueueDelegate])
          .with('count', 1)
          .build();
        mockQueueService.getDelegates.mockResolvedValue(rawify(page) as never);

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

        expect(mockQueueService.postDelegate).toHaveBeenCalledTimes(1);
        expect(mockQueueService.postDelegate).toHaveBeenCalledWith(args);
        expect(mockTransactionApi.postDelegateV2).not.toHaveBeenCalled();

        // fire-and-forget cache invalidation
        await new Promise(setImmediate);
        expect(mockQueueService.clearDelegates).toHaveBeenCalledTimes(1);
        expect(mockQueueService.clearDelegates).toHaveBeenCalledWith({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
        });
      });
    });

    describe('updateDelegate', () => {
      it('uses the queue service, not the tx-service, and invalidates cache', async () => {
        const args = {
          chainId: faker.string.numeric(),
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          delegate: getAddress(faker.finance.ethereumAddress()),
          delegator: getAddress(faker.finance.ethereumAddress()),
          signature: faker.string.hexadecimal(),
          label: faker.word.sample(),
        };

        await repository.updateDelegate(args);

        expect(mockQueueService.updateDelegate).toHaveBeenCalledTimes(1);
        expect(mockQueueService.updateDelegate).toHaveBeenCalledWith(args);
        expect(mockTransactionApi.updateDelegateV2).not.toHaveBeenCalled();

        await new Promise(setImmediate);
        expect(mockQueueService.clearDelegates).toHaveBeenCalledTimes(1);
        expect(mockQueueService.clearDelegates).toHaveBeenCalledWith({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
        });
      });
    });

    describe('deleteDelegate', () => {
      it('uses the queue service, not the tx-service, and invalidates cache', async () => {
        const args = {
          chainId: faker.string.numeric(),
          safeAddress: getAddress(faker.finance.ethereumAddress()),
          delegate: getAddress(faker.finance.ethereumAddress()),
          delegator: getAddress(faker.finance.ethereumAddress()),
          signature: faker.string.hexadecimal(),
        };

        await repository.deleteDelegate(args);

        expect(mockQueueService.deleteDelegate).toHaveBeenCalledTimes(1);
        expect(mockQueueService.deleteDelegate).toHaveBeenCalledWith(args);
        expect(mockTransactionApi.deleteDelegateV2).not.toHaveBeenCalled();

        await new Promise(setImmediate);
        expect(mockQueueService.clearDelegates).toHaveBeenCalledTimes(1);
        expect(mockQueueService.clearDelegates).toHaveBeenCalledWith({
          chainId: args.chainId,
          safeAddress: args.safeAddress,
        });
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
        expect(mockQueueService.clearDelegates).toHaveBeenCalledWith({
          chainId: args.chainId,
          safeAddress: undefined,
        });
      });
    });
  });
});
