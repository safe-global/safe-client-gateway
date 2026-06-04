// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { type Address, getAddress } from 'viem';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { CacheFirstDataSource } from '@/datasources/cache/cache.first.data.source';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import { CacheDir } from '@/datasources/cache/entities/cache-dir.entity';
import { CircuitBreakerKeys } from '@/datasources/circuit-breaker/circuit-breaker.keys';
import { HttpErrorFactory } from '@/datasources/errors/http-error-factory';
import type { INetworkService } from '@/datasources/network/network.service.interface';
import { delegateBuilder } from '@/modules/delegate/domain/entities/__tests__/delegate.builder';
import { messageBuilder } from '@/modules/messages/domain/entities/__tests__/message.builder';
import { queueMultisigTransactionBuilder } from '@/modules/queue/entities/__tests__/queue-multisig-transaction.builder';
import { QueueService } from '@/modules/queue/queue.service';
import { proposeTransactionDtoBuilder } from '@/modules/transactions/routes/entities/__tests__/propose-transaction.dto.builder';
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

  describe('getMultisigTransactionsBatch chunking', () => {
    // Each `safe_tx_hash=0x<64 hex>&` query pair is ~81 bytes. nginx's default
    // `large_client_header_buffers 4 8k` rejects request lines over ~8KB, AWS
    // ALB caps at 16KB, and many WAFs cap at 8KB. With 200 hashes the URL grows
    // past 16KB. Chunking at 50 keeps each request under ~4KB.
    it('chunks a 200-hash batch across multiple parallel calls under the URL safety threshold', async () => {
      const hashes = Array.from({ length: 200 }, () =>
        faker.string.hexadecimal({ length: 64 }),
      );
      networkService.get.mockResolvedValue({ data: rawify([]), status: 200 });

      await service.getMultisigTransactionsBatch({
        chainId,
        safeTxHashes: hashes,
      });

      expect(networkService.get).toHaveBeenCalledTimes(4);
    });

    it('issues a single call when input fits within one chunk', async () => {
      const hashes = Array.from({ length: 30 }, () =>
        faker.string.hexadecimal({ length: 64 }),
      );
      networkService.get.mockResolvedValueOnce({
        data: rawify([]),
        status: 200,
      });

      await service.getMultisigTransactionsBatch({
        chainId,
        safeTxHashes: hashes,
      });

      expect(networkService.get).toHaveBeenCalledTimes(1);
    });

    it('returns empty without hitting the network when input is empty', async () => {
      const result = await service.getMultisigTransactionsBatch({
        chainId,
        safeTxHashes: [],
      });

      expect(networkService.get).not.toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('proposeTransaction note handling', () => {
    it('sends the note (embedded in the origin) to the queue service as notes', async () => {
      const note = faker.lorem.sentence();
      const dto = proposeTransactionDtoBuilder()
        .with(
          'origin',
          JSON.stringify({
            name: faker.company.name(),
            url: faker.internet.url({ appendSlash: false }),
            note,
          }),
        )
        .build();
      networkService.post.mockResolvedValueOnce({
        data: rawify({}),
        status: 201,
      });

      await service.proposeTransaction({
        chainId,
        safeAddress,
        proposeTransactionDto: dto,
      });

      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: note }),
        }),
      );
    });

    it('sends a null note when the origin has no note', async () => {
      const dto = proposeTransactionDtoBuilder()
        .with(
          'origin',
          JSON.stringify({
            name: faker.company.name(),
            url: faker.internet.url({ appendSlash: false }),
          }),
        )
        .build();
      networkService.post.mockResolvedValueOnce({
        data: rawify({}),
        status: 201,
      });

      await service.proposeTransaction({
        chainId,
        safeAddress,
        proposeTransactionDto: dto,
      });

      expect(networkService.post).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ notes: null }),
        }),
      );
    });
  });

  describe('circuit breaker', () => {
    const withCircuitBreakerKey = expect.objectContaining({
      networkRequest: expect.objectContaining({
        circuitBreaker: {
          key: CircuitBreakerKeys.getQueueServiceKey(chainId),
        },
      }),
    });

    it('proposeTransaction includes the queue circuit breaker key', async () => {
      networkService.post.mockResolvedValueOnce({
        data: rawify({}),
        status: 201,
      });

      await service.proposeTransaction({
        chainId,
        safeAddress,
        proposeTransactionDto: proposeTransactionDtoBuilder().build(),
      });

      expect(networkService.post).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('getMultisigTransaction includes the queue circuit breaker key', async () => {
      mockDataSource.get.mockResolvedValueOnce(
        rawify(queueMultisigTransactionBuilder().build()),
      );

      await service.getMultisigTransaction({ chainId, safeTxHash });

      expect(mockDataSource.get).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('getMultisigTransactionsBatch includes the queue circuit breaker key', async () => {
      networkService.get.mockResolvedValueOnce({
        data: rawify([]),
        status: 200,
      });

      await service.getMultisigTransactionsBatch({
        chainId,
        safeTxHashes: [safeTxHash],
      });

      expect(networkService.get).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('getTransactionQueue includes the queue circuit breaker key', async () => {
      mockDataSource.get.mockResolvedValueOnce(rawify({ results: [] }));

      await service.getTransactionQueue({ chainId, safeAddress });

      expect(mockDataSource.get).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('postConfirmation includes the queue circuit breaker key', async () => {
      networkService.post.mockResolvedValueOnce({
        data: rawify({}),
        status: 200,
      });

      await service.postConfirmation({
        chainId,
        safeTxHash,
        signature: faker.string.hexadecimal({ length: 16 }),
      });

      expect(networkService.post).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('deleteTransaction includes the queue circuit breaker key', async () => {
      networkService.delete.mockResolvedValueOnce({
        data: rawify({}),
        status: 204,
      });

      await service.deleteTransaction({
        chainId,
        safeTxHash,
        signature: faker.string.hexadecimal({ length: 16 }),
      });

      expect(networkService.delete).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('getDelegates includes the queue circuit breaker key', async () => {
      mockDataSource.get.mockResolvedValueOnce(
        rawify({ results: [delegateBuilder().build()] }),
      );

      await service.getDelegates({ chainId, safeAddress });

      expect(mockDataSource.get).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('postDelegate includes the queue circuit breaker key', async () => {
      networkService.post.mockResolvedValueOnce({
        data: rawify({}),
        status: 201,
      });

      await service.postDelegate({
        chainId,
        safeAddress,
        delegate: getAddress(faker.finance.ethereumAddress()),
        delegator: getAddress(faker.finance.ethereumAddress()),
        signature: faker.string.hexadecimal({ length: 16 }),
        label: faker.lorem.word(),
      });

      expect(networkService.post).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('deleteDelegate includes the queue circuit breaker key', async () => {
      networkService.delete.mockResolvedValueOnce({
        data: rawify({}),
        status: 204,
      });

      await service.deleteDelegate({
        chainId,
        delegate: getAddress(faker.finance.ethereumAddress()),
        delegator: getAddress(faker.finance.ethereumAddress()),
        safeAddress,
        signature: faker.string.hexadecimal({ length: 16 }),
      });

      expect(networkService.delete).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('getMessageByHash includes the queue circuit breaker key', async () => {
      mockDataSource.get.mockResolvedValueOnce(
        rawify(messageBuilder().build()),
      );

      await service.getMessageByHash({ chainId, messageHash });

      expect(mockDataSource.get).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('getMessagesBySafe includes the queue circuit breaker key', async () => {
      mockDataSource.get.mockResolvedValueOnce(rawify({ results: [] }));

      await service.getMessagesBySafe({ chainId, safeAddress });

      expect(mockDataSource.get).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('postMessage includes the queue circuit breaker key', async () => {
      networkService.post.mockResolvedValueOnce({
        data: rawify({}),
        status: 201,
      });

      await service.postMessage({
        chainId,
        safeAddress,
        message: faker.lorem.sentence(),
        signature: faker.string.hexadecimal({ length: 16 }),
        origin: null,
      });

      expect(networkService.post).toHaveBeenCalledWith(withCircuitBreakerKey);
    });

    it('postMessageSignature includes the queue circuit breaker key', async () => {
      networkService.post.mockResolvedValueOnce({
        data: rawify({}),
        status: 200,
      });

      await service.postMessageSignature({
        chainId,
        messageHash,
        signature: faker.string.hexadecimal({ length: 16 }) as `0x${string}`,
      });

      expect(networkService.post).toHaveBeenCalledWith(withCircuitBreakerKey);
    });
  });
});
