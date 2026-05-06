// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import { messageBuilder } from '@/modules/messages/domain/entities/__tests__/message.builder';
import { queueMultisigTransactionBuilder } from '@/modules/queue/entities/__tests__/queue-multisig-transaction.builder';
import { QueueService } from '@/modules/queue/queue.service';
import { rawify } from '@/validation/entities/raw.entity';

const dataSource = {
  get: jest.fn(),
} as jest.MockedObjectDeep<CacheFirstDataSource>;
const mockDataSource = jest.mocked(dataSource);

const cacheService = {
  deleteByKey: jest.fn(),
} as unknown as jest.MockedObjectDeep<ICacheService>;
const mockCacheService = jest.mocked(cacheService);

const configurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;
const mockConfigurationService = jest.mocked(configurationService);

const networkService = jest.mocked({
  get: jest.fn(),
  post: jest.fn(),
  delete: jest.fn(),
} as jest.MockedObjectDeep<INetworkService>);

describe('QueueService', () => {
  const chainId = faker.string.numeric();
  const baseUri = faker.internet.url({ appendSlash: false });
  const safeAddress = getAddress(faker.finance.ethereumAddress());
  const safeTxHash = faker.string.hexadecimal({ length: 64 });
  const messageHash = faker.string.hexadecimal({ length: 64 });
  let service: QueueService;

  beforeEach(() => {
    jest.resetAllMocks();
    mockConfigurationService.getOrThrow.mockImplementation((key) => {
      if (key === 'queueService.baseUri') return baseUri;
      if (key === 'expirationTimeInSeconds.default') return 60;
      if (key === 'expirationTimeInSeconds.notFound.default') return 30;
      throw new Error(`Unexpected key: ${key}`);
    });

    service = new QueueService(
      mockConfigurationService,
      networkService,
      mockCacheService,
      mockDataSource,
      new HttpErrorFactory(),
    );
  });

  describe('getMultisigTransaction', () => {
    it('Should read the queue_multisig_transaction cache key, not the tx-service multisig_transaction key', async () => {
      const tx = queueMultisigTransactionBuilder()
        .with('safeTxHash', safeTxHash as `0x${string}`)
        .build();
      mockDataSource.get.mockResolvedValueOnce(rawify(tx));

      await service.getMultisigTransaction({ chainId, safeTxHash });

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      const cacheDir = (
        mockDataSource.get.mock.calls[0][0] as { cacheDir: CacheDir }
      ).cacheDir;
      expect(cacheDir.key).toBe(
        `${chainId}_queue_multisig_transaction_${safeTxHash}`,
      );
      expect(cacheDir.key).not.toBe(
        `${chainId}_multisig_transaction_${safeTxHash}`,
      );
    });
  });

  describe('getTransactionQueue', () => {
    it('Should read the queue_multisig_transactions cache key, not the tx-service multisig_transactions key', async () => {
      mockDataSource.get.mockResolvedValueOnce(rawify({ results: [] }));

      await service.getTransactionQueue({ chainId, safeAddress });

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      const cacheDir = (
        mockDataSource.get.mock.calls[0][0] as { cacheDir: CacheDir }
      ).cacheDir;
      expect(cacheDir.key).toBe(
        `${chainId}_queue_multisig_transactions_${safeAddress}`,
      );
      expect(cacheDir.key).not.toBe(
        `${chainId}_multisig_transactions_${safeAddress}`,
      );
    });
  });

  describe('getMessageByHash', () => {
    it('Should read the queue_message cache key, not the tx-service message key', async () => {
      mockDataSource.get.mockResolvedValueOnce(
        rawify(messageBuilder().build()),
      );

      await service.getMessageByHash({ chainId, messageHash });

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      const cacheDir = (
        mockDataSource.get.mock.calls[0][0] as { cacheDir: CacheDir }
      ).cacheDir;
      expect(cacheDir.key).toBe(`${chainId}_queue_message_${messageHash}`);
      expect(cacheDir.key).not.toBe(`${chainId}_message_${messageHash}`);
    });
  });

  describe('getMessagesBySafe', () => {
    it('Should read the queue_messages cache key, not the tx-service messages key', async () => {
      mockDataSource.get.mockResolvedValueOnce(rawify({ results: [] }));

      await service.getMessagesBySafe({ chainId, safeAddress });

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      const cacheDir = (
        mockDataSource.get.mock.calls[0][0] as { cacheDir: CacheDir }
      ).cacheDir;
      expect(cacheDir.key).toBe(`${chainId}_queue_messages_${safeAddress}`);
      expect(cacheDir.key).not.toBe(`${chainId}_messages_${safeAddress}`);
    });
  });

  describe('getDelegates', () => {
    it('Should read the queue_delegates cache key, not the tx-service delegates key', async () => {
      mockDataSource.get.mockResolvedValueOnce(
        rawify({ results: [delegateBuilder().build()] }),
      );

      await service.getDelegates({ chainId, safeAddress });

      expect(mockDataSource.get).toHaveBeenCalledTimes(1);
      const cacheDir = (
        mockDataSource.get.mock.calls[0][0] as { cacheDir: CacheDir }
      ).cacheDir;
      expect(cacheDir.key).toBe(`${chainId}_queue_delegates_${safeAddress}`);
      expect(cacheDir.key).not.toBe(`${chainId}_delegates_${safeAddress}`);
    });
  });

  describe('clearMultisigTransaction', () => {
    it('Should delete the queue_multisig_transaction cache key', async () => {
      await service.clearMultisigTransaction({ chainId, safeTxHash });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_queue_multisig_transaction_${safeTxHash}`,
      );
    });
  });

  describe('clearAllTransactions', () => {
    it('Should delete the queue_multisig_transactions cache key (regression: previously deleted unrelated all_transactions key)', async () => {
      await service.clearAllTransactions({ chainId, safeAddress });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_queue_multisig_transactions_${safeAddress}`,
      );
      expect(mockCacheService.deleteByKey).not.toHaveBeenCalledWith(
        `${chainId}_all_transactions_${safeAddress}`,
      );
    });
  });

  describe('clearMessagesBySafe', () => {
    it('Should delete the queue_messages cache key', async () => {
      await service.clearMessagesBySafe({ chainId, safeAddress });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_queue_messages_${safeAddress}`,
      );
    });
  });

  describe('clearMessagesByHash', () => {
    it('Should delete the queue_message cache key', async () => {
      await service.clearMessagesByHash({ chainId, messageHash });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_queue_message_${messageHash}`,
      );
    });
  });

  describe('clearDelegates', () => {
    it('Should delete the queue_delegates cache key', async () => {
      await service.clearDelegates({
        chainId,
        safeAddress: safeAddress as Address,
      });

      expect(mockCacheService.deleteByKey).toHaveBeenCalledTimes(1);
      expect(mockCacheService.deleteByKey).toHaveBeenCalledWith(
        `${chainId}_queue_delegates_${safeAddress}`,
      );
    });
  });
});
