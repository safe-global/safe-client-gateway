// SPDX-License-Identifier: FSL-1.1-MIT
import { SafeRepository } from '@/modules/safe/domain/safe.repository';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import type { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { IQueue } from '@/modules/queue/queue.interface';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { SafeV2 } from '@/modules/safe/domain/entities/safe.entity';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import {
  ethereumTransactionBuilder,
  toJson as ethereumTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/ethereum-transaction.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/module-transaction.builder';
import type { QueueMultisigTransactionEntity } from '@/modules/queue/entities/multisig-transaction.entity';
import { buildOrigin } from '@/modules/queue/helpers/origin.helper';
import type { Hex } from 'viem';
import { Operation } from '@/modules/safe/domain/entities/operation.entity';

const mockTransactionApiManager = {
  getApi: vi.fn(),
} as MockedObject<ITransactionApiManager>;

const mockTransactionApi = {
  getSafesByOwnerV2: vi.fn(),
  getAllTransactions: vi.fn(),
  getSafe: vi.fn(),
  getMultisigTransaction: vi.fn(),
  getMultisigTransactionWithNoCache: vi.fn(),
  getMultisigTransactions: vi.fn(),
  getMultisigTransactionsWithNoCache: vi.fn(),
} as MockedObject<ITransactionApi>;

function buildQueueEntity(overrides: {
  chainId: string;
  safe: Address;
  safeTxHash: Hex;
  originName: string | null;
  originUrl: string | null;
}): QueueMultisigTransactionEntity {
  return {
    safeTxHash: overrides.safeTxHash,
    chainId: overrides.chainId,
    safe: overrides.safe,
    nonce: faker.number.int({ min: 0, max: 100 }),
    proposer: getAddress(faker.finance.ethereumAddress()),
    proposedByDelegate: null,
    to: getAddress(faker.finance.ethereumAddress()),
    value: faker.string.numeric(),
    data: null,
    operation: Operation.CALL,
    safeTxGas: null,
    baseGas: null,
    gasPrice: null,
    gasToken: null,
    refundReceiver: null,
    failed: false,
    notes: null,
    originName: overrides.originName,
    originUrl: overrides.originUrl,
    txHash: faker.string.hexadecimal({ length: 64 }) as Hex,
    created: faker.date.recent(),
    modified: faker.date.recent(),
    confirmations: [],
  };
}

const mockLoggingService = {
  error: vi.fn(),
  warn: vi.fn(),
  info: vi.fn(),
  debug: vi.fn(),
} as MockedObject<ILoggingService>;

const mockChainsRepository = {
  getAllChains: vi.fn(),
} as MockedObject<IChainsRepository>;

const mockTransactionVerifier = {
  verifyApiTransaction: vi.fn(),
  verifyConfirmation: vi.fn(),
  verifyProposal: vi.fn(),
} as MockedObject<TransactionVerifierHelper>;

const mockConfigurationService = {
  getOrThrow: vi.fn(),
} as MockedObject<IConfigurationService>;

const mockQueueService = {
  getMultisigTransaction: vi.fn(),
  getMultisigTransactionsBatch: vi.fn(),
  getTransactionQueue: vi.fn(),
  proposeTransaction: vi.fn(),
  postConfirmation: vi.fn(),
  deleteTransaction: vi.fn(),
  getDelegates: vi.fn(),
  postDelegate: vi.fn(),
  deleteDelegate: vi.fn(),
  getMessageByHash: vi.fn(),
  getMessagesBySafe: vi.fn(),
  postMessage: vi.fn(),
  postMessageSignature: vi.fn(),
  clearMultisigTransaction: vi.fn(),
  clearMultisigTransactions: vi.fn(),
  clearAllTransactions: vi.fn(),
  clearMessagesBySafe: vi.fn(),
  clearMessagesByHash: vi.fn(),
  clearDelegates: vi.fn(),
} as MockedObject<IQueue>;

describe('SafeRepository', () => {
  let repository: SafeRepository;
  const maxSequentialPages = 5;

  function createRepository(opts: {
    queueServiceEnabled: boolean;
  }): SafeRepository {
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'safeConfig.safes.maxSequentialPages') {
        return maxSequentialPages;
      }
      if (key === 'features.queueService') {
        return opts.queueServiceEnabled;
      }
      throw new Error(`Unexpected key: ${key}`);
    });
    return new SafeRepository(
      mockTransactionApiManager,
      mockLoggingService,
      mockChainsRepository,
      mockTransactionVerifier,
      mockConfigurationService,
      mockQueueService,
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    repository = createRepository({ queueServiceEnabled: true });
  });

  describe('getSafesByOwnerV2', () => {
    const chainId = faker.string.numeric();
    const ownerAddress = faker.finance.ethereumAddress() as Address;

    const createSafeV2 = (): SafeV2 => ({
      address: getAddress(faker.finance.ethereumAddress()),
      owners: [getAddress(faker.finance.ethereumAddress())],
      threshold: faker.number.int({ min: 1 }),
      nonce: faker.number.int({ min: 0 }),
      masterCopy: getAddress(faker.finance.ethereumAddress()),
      fallbackHandler: getAddress(faker.finance.ethereumAddress()),
      guard: getAddress(faker.finance.ethereumAddress()),
      moduleGuard: getAddress(faker.finance.ethereumAddress()),
      enabledModules: [getAddress(faker.finance.ethereumAddress())],
    });

    it('should return safes from a single page', async () => {
      const safes = [createSafeV2(), createSafeV2()];
      const page = pageBuilder<SafeV2>()
        .with('results', safes)
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2.mockResolvedValue(rawify(page));

      const result = await repository.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(1);
      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledWith({
        ownerAddress,
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        offset: 0,
      });
      expect(result).toEqual({
        safes: safes.map((safe) => safe.address),
      });
      expect(mockLoggingService.error).not.toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      const page = pageBuilder<SafeV2>()
        .with('results', [])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2.mockResolvedValue(rawify(page));

      const result = await repository.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(result).toEqual({ safes: [] });
    });

    it('should paginate through multiple pages', async () => {
      const safesPage1 = [createSafeV2(), createSafeV2()];
      const safesPage2 = [createSafeV2()];
      const baseUrl = 'https://example.com/api/v2/owners/safes/';

      const page1 = pageBuilder<SafeV2>()
        .with('results', safesPage1)
        .with(
          'next',
          `${baseUrl}?limit=${SAFE_TRANSACTION_SERVICE_MAX_LIMIT}&offset=${SAFE_TRANSACTION_SERVICE_MAX_LIMIT}`,
        )
        .with('previous', null)
        .build();

      const page2 = pageBuilder<SafeV2>()
        .with('results', safesPage2)
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2
        .mockResolvedValueOnce(rawify(page1))
        .mockResolvedValueOnce(rawify(page2));

      const result = await repository.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(2);
      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenNthCalledWith(1, {
        ownerAddress,
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        offset: 0,
      });
      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenNthCalledWith(2, {
        ownerAddress,
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        offset: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
      });

      const allSafes = [...safesPage1, ...safesPage2];
      expect(result).toEqual({
        safes: allSafes.map((safe) => safe.address),
      });
    });

    it('should handle max sequential pages limit', async () => {
      const baseUrl = 'https://example.com/api/v2/owners/safes/';
      const safes = [createSafeV2()];

      // Create pages that exceed maxSequentialPages
      const pages = Array.from({ length: maxSequentialPages + 1 }, (_, i) =>
        pageBuilder<SafeV2>()
          .with('results', safes)
          .with(
            'next',
            i < maxSequentialPages
              ? `${baseUrl}?limit=${SAFE_TRANSACTION_SERVICE_MAX_LIMIT}&offset=${(i + 1) * SAFE_TRANSACTION_SERVICE_MAX_LIMIT}`
              : null,
          )
          .with('previous', null)
          .build(),
      );

      pages.forEach((page) => {
        mockTransactionApi.getSafesByOwnerV2.mockResolvedValueOnce(
          rawify(page),
        );
      });

      const result = await repository.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(
        maxSequentialPages,
      );
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        `Max sequential pages reached for getSafesByOwnerV2. chainId=${chainId}, ownerAddress=${ownerAddress}`,
      );
      expect(result.safes).toHaveLength(maxSequentialPages);
    });

    it('should extract offset from next URL correctly', async () => {
      const safesPage1 = [createSafeV2()];
      const safesPage2 = [createSafeV2()];
      const baseUrl = 'https://example.com/api/v2/owners/safes/';
      const customOffset = 150;

      const page1 = pageBuilder<SafeV2>()
        .with('results', safesPage1)
        .with(
          'next',
          `${baseUrl}?limit=${SAFE_TRANSACTION_SERVICE_MAX_LIMIT}&offset=${customOffset}`,
        )
        .with('previous', null)
        .build();

      const page2 = pageBuilder<SafeV2>()
        .with('results', safesPage2)
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2
        .mockResolvedValueOnce(rawify(page1))
        .mockResolvedValueOnce(rawify(page2));

      await repository.getSafesByOwnerV2({
        chainId,
        ownerAddress,
      });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenNthCalledWith(2, {
        ownerAddress,
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        offset: customOffset,
      });
    });

    it('should handle API errors', async () => {
      const error = new Error('API error');
      mockTransactionApi.getSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        repository.getSafesByOwnerV2({
          chainId,
          ownerAddress,
        }),
      ).rejects.toThrow('API error');
    });

    it('should handle schema validation errors', async () => {
      const invalidPage = pageBuilder<SafeV2>()
        .with('results', [{ invalid: 'data' }] as unknown as Array<SafeV2>)
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2.mockResolvedValue(
        rawify(invalidPage),
      );

      await expect(
        repository.getSafesByOwnerV2({
          chainId,
          ownerAddress,
        }),
      ).rejects.toThrow();
    });
  });

  describe('getAllSafesByOwnerV2', () => {
    const ownerAddress = faker.finance.ethereumAddress() as Address;

    const createSafeV2 = (): SafeV2 => ({
      address: getAddress(faker.finance.ethereumAddress()),
      owners: [getAddress(faker.finance.ethereumAddress())],
      threshold: faker.number.int({ min: 1 }),
      nonce: faker.number.int({ min: 0 }),
      masterCopy: getAddress(faker.finance.ethereumAddress()),
      fallbackHandler: getAddress(faker.finance.ethereumAddress()),
      guard: getAddress(faker.finance.ethereumAddress()),
      moduleGuard: getAddress(faker.finance.ethereumAddress()),
      enabledModules: [getAddress(faker.finance.ethereumAddress())],
    });

    it('should return safes from several chains', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '137').build();
      const chains = [chain1, chain2];

      const safesChain1 = [createSafeV2(), createSafeV2()];
      const safesChain2 = [createSafeV2()];

      mockChainsRepository.getAllChains.mockResolvedValue(chains);
      mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);

      const page1 = pageBuilder<SafeV2>()
        .with('results', safesChain1)
        .with('next', null)
        .with('previous', null)
        .build();

      const page2 = pageBuilder<SafeV2>()
        .with('results', safesChain2)
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2
        .mockResolvedValueOnce(rawify(page1))
        .mockResolvedValueOnce(rawify(page2));

      const result = await repository.getAllSafesByOwnerV2({ ownerAddress });

      expect(mockChainsRepository.getAllChains).toHaveBeenCalledTimes(1);
      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        '1': safesChain1.map((safe) => safe.address),
        '137': safesChain2.map((safe) => safe.address),
      });
    });

    it('should handle chain failures gracefully', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '137').build();
      const chains = [chain1, chain2];

      const safesChain1 = [createSafeV2()];
      const error = new Error('Chain 137 failed');

      mockChainsRepository.getAllChains.mockResolvedValue(chains);
      mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);

      const page1 = pageBuilder<SafeV2>()
        .with('results', safesChain1)
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2
        .mockResolvedValueOnce(rawify(page1))
        .mockRejectedValueOnce(error);

      const result = await repository.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual({
        '1': safesChain1.map((safe) => safe.address),
        '137': null,
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        'Failed to fetch Safe owners. chainId=137',
      );
    });

    it('should handle multiple chains failing', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chain2 = chainBuilder().with('chainId', '137').build();
      const chains = [chain1, chain2];

      const error = new Error('API error');

      mockChainsRepository.getAllChains.mockResolvedValue(chains);
      mockTransactionApi.getSafesByOwnerV2.mockRejectedValue(error);

      const result = await repository.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual({
        '1': null,
        '137': null,
      });
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(2);
    });

    it('should handle empty chains list', async () => {
      mockChainsRepository.getAllChains.mockResolvedValue([]);

      const result = await repository.getAllSafesByOwnerV2({ ownerAddress });

      expect(result).toEqual({});
      expect(mockTransactionApi.getSafesByOwnerV2).not.toHaveBeenCalled();
    });

    it('should handle pagination for each chain', async () => {
      const chain1 = chainBuilder().with('chainId', '1').build();
      const chains = [chain1];

      const safesPage1 = [createSafeV2()];
      const safesPage2 = [createSafeV2()];
      const baseUrl = 'https://example.com/api/v2/owners/safes/';

      mockChainsRepository.getAllChains.mockResolvedValue(chains);
      mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);

      const page1 = pageBuilder<SafeV2>()
        .with('results', safesPage1)
        .with(
          'next',
          `${baseUrl}?limit=${SAFE_TRANSACTION_SERVICE_MAX_LIMIT}&offset=${SAFE_TRANSACTION_SERVICE_MAX_LIMIT}`,
        )
        .with('previous', null)
        .build();

      const page2 = pageBuilder<SafeV2>()
        .with('results', safesPage2)
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2
        .mockResolvedValueOnce(rawify(page1))
        .mockResolvedValueOnce(rawify(page2));

      const result = await repository.getAllSafesByOwnerV2({ ownerAddress });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(2);
      const allSafes = [...safesPage1, ...safesPage2];
      expect(result).toEqual({
        '1': allSafes.map((safe) => safe.address),
      });
    });

    it('should handle errors from getAllChains', async () => {
      const error = new Error('Failed to get chains');
      mockChainsRepository.getAllChains.mockRejectedValue(error);

      await expect(
        repository.getAllSafesByOwnerV2({ ownerAddress }),
      ).rejects.toThrow('Failed to get chains');
    });
  });

  describe('getTransactionHistory', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    const buildQueueEntityForSafe = (overrides: {
      safeTxHash: Hex;
      originName: string | null;
      originUrl: string | null;
    }): QueueMultisigTransactionEntity =>
      buildQueueEntity({ chainId, safe: safeAddress, ...overrides });

    it('replaces origin on every multisig entry with queue-service metadata', async () => {
      const multisigA = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin-A')
        .build();
      const multisigB = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin-B')
        .build();

      const page = pageBuilder<unknown>()
        .with('results', [
          multisigTransactionToJson(multisigA),
          multisigTransactionToJson(multisigB),
        ])
        .with('next', null)
        .with('previous', null)
        .build();

      const queueA = buildQueueEntityForSafe({
        safeTxHash: multisigA.safeTxHash,
        originName: 'AppA',
        originUrl: 'https://a.example',
      });
      const queueB = buildQueueEntityForSafe({
        safeTxHash: multisigB.safeTxHash,
        originName: 'AppB',
        originUrl: 'https://b.example',
      });

      mockTransactionApi.getAllTransactions.mockResolvedValue(rawify(page));
      mockQueueService.getMultisigTransactionsBatch.mockResolvedValue(
        rawify([queueA, queueB]),
      );

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(mockTransactionApi.getAllTransactions).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        executed: true,
        queued: false,
      });
      expect(
        mockQueueService.getMultisigTransactionsBatch,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockQueueService.getMultisigTransactionsBatch,
      ).toHaveBeenCalledWith({
        chainId,
        safeTxHashes: [multisigA.safeTxHash, multisigB.safeTxHash],
      });
      expect(result.results).toHaveLength(2);
      expect(result.results[0]).toMatchObject({
        safeTxHash: multisigA.safeTxHash,
        origin: buildOrigin('AppA', 'https://a.example'),
      });
      expect(result.results[1]).toMatchObject({
        safeTxHash: multisigB.safeTxHash,
        origin: buildOrigin('AppB', 'https://b.example'),
      });
    });

    it('leaves non-multisig entries (ethereum, module) untouched', async () => {
      const multisig = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      const ethereum = ethereumTransactionBuilder().build();
      const moduleTx = moduleTransactionBuilder()
        .with('safe', safeAddress)
        .build();

      const page = pageBuilder<unknown>()
        .with('results', [
          multisigTransactionToJson(multisig),
          ethereumTransactionToJson(ethereum),
          moduleTransactionToJson(moduleTx),
        ])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getAllTransactions.mockResolvedValue(rawify(page));
      mockQueueService.getMultisigTransactionsBatch.mockResolvedValue(
        rawify([
          buildQueueEntityForSafe({
            safeTxHash: multisig.safeTxHash,
            originName: 'App',
            originUrl: 'https://app.example',
          }),
        ]),
      );

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(
        mockQueueService.getMultisigTransactionsBatch,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockQueueService.getMultisigTransactionsBatch,
      ).toHaveBeenCalledWith({
        chainId,
        safeTxHashes: [multisig.safeTxHash],
      });

      const [resultMultisig, resultEthereum, resultModule] = result.results;
      expect(resultMultisig).toMatchObject({
        safeTxHash: multisig.safeTxHash,
        origin: buildOrigin('App', 'https://app.example'),
      });
      expect(resultEthereum).toMatchObject({
        txHash: ethereum.txHash,
        from: ethereum.from,
      });
      expect(resultModule).toMatchObject({
        transactionHash: moduleTx.transactionHash,
        module: moduleTx.module,
      });
    });

    it('falls back to tx-service origin for hashes the batch response omits', async () => {
      const multisigOk = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin-ok')
        .build();
      const multisigMissing = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin-fail')
        .build();

      const page = pageBuilder<unknown>()
        .with('results', [
          multisigTransactionToJson(multisigOk),
          multisigTransactionToJson(multisigMissing),
        ])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getAllTransactions.mockResolvedValue(rawify(page));
      mockQueueService.getMultisigTransactionsBatch.mockResolvedValue(
        rawify([
          buildQueueEntityForSafe({
            safeTxHash: multisigOk.safeTxHash,
            originName: 'AppOk',
            originUrl: 'https://ok.example',
          }),
        ]),
      );

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(result.results[0]).toMatchObject({
        safeTxHash: multisigOk.safeTxHash,
        origin: buildOrigin('AppOk', 'https://ok.example'),
      });
      expect(result.results[1]).toMatchObject({
        safeTxHash: multisigMissing.safeTxHash,
        origin: 'tx-service-origin-fail',
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(multisigMissing.safeTxHash),
      );
    });

    it('keeps tx-service origin on every entry when the batch call fails', async () => {
      const multisig = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();

      const page = pageBuilder<unknown>()
        .with('results', [multisigTransactionToJson(multisig)])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getAllTransactions.mockResolvedValue(rawify(page));
      mockQueueService.getMultisigTransactionsBatch.mockRejectedValue(
        new Error('queue unreachable'),
      );

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(result.results[0]).toMatchObject({
        safeTxHash: multisig.safeTxHash,
        origin: 'tx-service-origin',
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(chainId),
      );
    });

    it('skips queue-service calls entirely when the page has no multisig entries', async () => {
      const ethereum = ethereumTransactionBuilder().build();

      const page = pageBuilder<unknown>()
        .with('results', [ethereumTransactionToJson(ethereum)])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getAllTransactions.mockResolvedValue(rawify(page));

      await repository.getTransactionHistory({ chainId, safeAddress });

      expect(
        mockQueueService.getMultisigTransactionsBatch,
      ).not.toHaveBeenCalled();
    });

    it('sets origin to null when the queue record has no originName and no originUrl', async () => {
      const multisig = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();

      const page = pageBuilder<unknown>()
        .with('results', [multisigTransactionToJson(multisig)])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getAllTransactions.mockResolvedValue(rawify(page));
      mockQueueService.getMultisigTransactionsBatch.mockResolvedValue(
        rawify([
          buildQueueEntityForSafe({
            safeTxHash: multisig.safeTxHash,
            originName: null,
            originUrl: null,
          }),
        ]),
      );

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(result.results[0]).toMatchObject({
        safeTxHash: multisig.safeTxHash,
        origin: null,
      });
    });
  });

  describe('getMultiSigTransaction', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('overrides origin with the queue-service value', async () => {
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockQueueService.getMultisigTransaction.mockResolvedValue(
        rawify(
          buildQueueEntity({
            chainId,
            safe: safeAddress,
            safeTxHash: tx.safeTxHash,
            originName: 'App',
            originUrl: 'https://app.example',
          }),
        ),
      );

      const result = await repository.getMultiSigTransaction({
        chainId,
        safeTransactionHash: tx.safeTxHash,
      });

      expect(result.origin).toBe(buildOrigin('App', 'https://app.example'));
      expect(mockQueueService.getMultisigTransaction).toHaveBeenCalledWith({
        chainId,
        safeTxHash: tx.safeTxHash,
      });
    });

    it('keeps tx-service origin when the queue call fails', async () => {
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockQueueService.getMultisigTransaction.mockRejectedValue(
        new Error('queue unreachable'),
      );

      const result = await repository.getMultiSigTransaction({
        chainId,
        safeTransactionHash: tx.safeTxHash,
      });

      expect(result.origin).toBe('tx-service-origin');
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(tx.safeTxHash),
      );
    });

    it('skips the queue call entirely when FF_QUEUE_SERVICE is off', async () => {
      const repo = createRepository({ queueServiceEnabled: false });
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );

      const result = await repo.getMultiSigTransaction({
        chainId,
        safeTransactionHash: tx.safeTxHash,
      });

      expect(result.origin).toBe('tx-service-origin');
      expect(mockQueueService.getMultisigTransaction).not.toHaveBeenCalled();
    });
  });

  describe('getMultiSigTransactionWithNoCache', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safe = safeBuilder().with('address', safeAddress).build();

    it('overrides origin with the queue-service value', async () => {
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransactionWithNoCache.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockTransactionApi.getSafe.mockResolvedValue(rawify(safe));
      mockQueueService.getMultisigTransaction.mockResolvedValue(
        rawify(
          buildQueueEntity({
            chainId,
            safe: safeAddress,
            safeTxHash: tx.safeTxHash,
            originName: 'App',
            originUrl: 'https://app.example',
          }),
        ),
      );

      const result = await repository.getMultiSigTransactionWithNoCache({
        chainId,
        safeTransactionHash: tx.safeTxHash,
      });

      expect(result.origin).toBe(buildOrigin('App', 'https://app.example'));
    });

    it('skips the queue call entirely when FF_QUEUE_SERVICE is off', async () => {
      const repo = createRepository({ queueServiceEnabled: false });
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransactionWithNoCache.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockTransactionApi.getSafe.mockResolvedValue(rawify(safe));

      const result = await repo.getMultiSigTransactionWithNoCache({
        chainId,
        safeTransactionHash: tx.safeTxHash,
      });

      expect(result.origin).toBe('tx-service-origin');
      expect(mockQueueService.getMultisigTransaction).not.toHaveBeenCalled();
    });
  });

  describe('getMultisigTransactions', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('overrides origin on each entry from the batch response', async () => {
      const txA = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin-A')
        .build();
      const txB = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin-B')
        .build();
      const page = pageBuilder<unknown>()
        .with('results', [
          multisigTransactionToJson(txA),
          multisigTransactionToJson(txB),
        ])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(page),
      );
      mockQueueService.getMultisigTransactionsBatch.mockResolvedValue(
        rawify([
          buildQueueEntity({
            chainId,
            safe: safeAddress,
            safeTxHash: txA.safeTxHash,
            originName: 'AppA',
            originUrl: 'https://a.example',
          }),
          buildQueueEntity({
            chainId,
            safe: safeAddress,
            safeTxHash: txB.safeTxHash,
            originName: 'AppB',
            originUrl: 'https://b.example',
          }),
        ]),
      );

      const result = await repository.getMultisigTransactions({
        chainId,
        safeAddress,
      });

      expect(result.results[0].origin).toBe(
        buildOrigin('AppA', 'https://a.example'),
      );
      expect(result.results[1].origin).toBe(
        buildOrigin('AppB', 'https://b.example'),
      );
      expect(
        mockQueueService.getMultisigTransactionsBatch,
      ).toHaveBeenCalledWith({
        chainId,
        safeTxHashes: [txA.safeTxHash, txB.safeTxHash],
      });
    });

    it('keeps tx-service origin for hashes the batch omits', async () => {
      const txKept = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin-kept')
        .build();
      const txMissing = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin-missing')
        .build();
      const page = pageBuilder<unknown>()
        .with('results', [
          multisigTransactionToJson(txKept),
          multisigTransactionToJson(txMissing),
        ])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(page),
      );
      mockQueueService.getMultisigTransactionsBatch.mockResolvedValue(
        rawify([
          buildQueueEntity({
            chainId,
            safe: safeAddress,
            safeTxHash: txKept.safeTxHash,
            originName: 'AppKept',
            originUrl: 'https://kept.example',
          }),
        ]),
      );

      const result = await repository.getMultisigTransactions({
        chainId,
        safeAddress,
      });

      expect(result.results[0].origin).toBe(
        buildOrigin('AppKept', 'https://kept.example'),
      );
      expect(result.results[1].origin).toBe('tx-service-origin-missing');
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(txMissing.safeTxHash),
      );
    });

    it('skips the queue call entirely when FF_QUEUE_SERVICE is off', async () => {
      const repo = createRepository({ queueServiceEnabled: false });
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      const page = pageBuilder<unknown>()
        .with('results', [multisigTransactionToJson(tx)])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getMultisigTransactions.mockResolvedValue(
        rawify(page),
      );

      const result = await repo.getMultisigTransactions({
        chainId,
        safeAddress,
      });

      expect(result.results[0].origin).toBe('tx-service-origin');
      expect(
        mockQueueService.getMultisigTransactionsBatch,
      ).not.toHaveBeenCalled();
    });
  });

  describe('getMultisigTransactionsWithNoCache', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());
    const safe = safeBuilder().with('address', safeAddress).build();

    it('overrides origin on each entry from the batch response', async () => {
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      const page = pageBuilder<unknown>()
        .with('results', [multisigTransactionToJson(tx)])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getMultisigTransactionsWithNoCache.mockResolvedValue(
        rawify(page),
      );
      mockTransactionApi.getSafe.mockResolvedValue(rawify(safe));
      mockQueueService.getMultisigTransactionsBatch.mockResolvedValue(
        rawify([
          buildQueueEntity({
            chainId,
            safe: safeAddress,
            safeTxHash: tx.safeTxHash,
            originName: 'App',
            originUrl: 'https://app.example',
          }),
        ]),
      );

      const result = await repository.getMultisigTransactionsWithNoCache({
        chainId,
        safeAddress,
      });

      expect(result.results[0].origin).toBe(
        buildOrigin('App', 'https://app.example'),
      );
    });

    it('skips the queue call entirely when FF_QUEUE_SERVICE is off', async () => {
      const repo = createRepository({ queueServiceEnabled: false });
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      const page = pageBuilder<unknown>()
        .with('results', [multisigTransactionToJson(tx)])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getMultisigTransactionsWithNoCache.mockResolvedValue(
        rawify(page),
      );
      mockTransactionApi.getSafe.mockResolvedValue(rawify(safe));

      const result = await repo.getMultisigTransactionsWithNoCache({
        chainId,
        safeAddress,
      });

      expect(result.results[0].origin).toBe('tx-service-origin');
      expect(
        mockQueueService.getMultisigTransactionsBatch,
      ).not.toHaveBeenCalled();
    });
  });
});
