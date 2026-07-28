// SPDX-License-Identifier: FSL-1.1-MIT

import { faker } from '@faker-js/faker';
import type { Address, Hex } from 'viem';
import { getAddress } from 'viem';
import type { MockedObject } from 'vitest';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import {
  ethereumTransactionBuilder,
  toJson as ethereumTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/ethereum-transaction.builder';
import {
  moduleTransactionBuilder,
  toJson as moduleTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/module-transaction.builder';
import {
  multisigTransactionBuilder,
  toJson as multisigTransactionToJson,
} from '@/modules/safe/domain/entities/__tests__/multisig-transaction.builder';
import { safeBuilder } from '@/modules/safe/domain/entities/__tests__/safe.builder';
import type { SafeV2 } from '@/modules/safe/domain/entities/safe.entity';
import { SafeRepository } from '@/modules/safe/domain/safe.repository';
import { createMockSafeQueueService } from '@/modules/safe-queue/__tests__/safe-queue-service.mock';
import { safeQueueMultisigTransactionBuilder } from '@/modules/safe-queue/entities/__tests__/queue-multisig-transaction.builder';
import type { SafeQueueMultisigTransactionEntity } from '@/modules/safe-queue/entities/multisig-transaction.entity';
import { buildOrigin } from '@/modules/safe-queue/helpers/origin.helper';
import { proposeTransactionDtoBuilder } from '@/modules/transactions/routes/entities/__tests__/propose-transaction.dto.builder';
import type { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import { rawify } from '@/validation/entities/raw.entity';

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
  deleteTransaction: vi.fn(),
  postMultisigTransaction: vi.fn(),
  clearMultisigTransaction: vi.fn(),
  clearMultisigTransactions: vi.fn(),
} as MockedObject<ITransactionApi>;

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

const mockSafeQueueService = createMockSafeQueueService();

describe('SafeRepository', () => {
  let repository: SafeRepository;
  const maxSequentialPages = 5;

  function createRepository(opts: {
    safeQueueEnabled: boolean;
  }): SafeRepository {
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'safeConfig.safes.maxSequentialPages') {
        return maxSequentialPages;
      }
      if (key === 'features.safeQueueService') {
        return opts.safeQueueEnabled;
      }
      throw new Error(`Unexpected key: ${key}`);
    });
    return new SafeRepository(
      mockTransactionApiManager,
      mockLoggingService,
      mockChainsRepository,
      mockTransactionVerifier,
      mockConfigurationService,
      mockSafeQueueService,
    );
  }

  beforeEach(() => {
    vi.resetAllMocks();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    repository = createRepository({ safeQueueEnabled: true });
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

      for (const page of pages) {
        mockTransactionApi.getSafesByOwnerV2.mockResolvedValueOnce(
          rawify(page),
        );
      }

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
      notes?: string | null;
    }): SafeQueueMultisigTransactionEntity =>
      safeQueueMultisigTransactionBuilder()
        .with('chainId', chainId)
        .with('safe', safeAddress)
        .with('safeTxHash', overrides.safeTxHash)
        .with('originName', overrides.originName)
        .with('originUrl', overrides.originUrl)
        .with('notes', overrides.notes ?? null)
        .build();

    it('should replace origin on every multisig entry with queue-service metadata', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        queueA,
        queueB,
      ]);

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
        mockSafeQueueService.getMultisigTransactionsBatch,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockSafeQueueService.getMultisigTransactionsBatch,
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

    it('should preserve the queue note in the batch origin overlay', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        buildQueueEntityForSafe({
          safeTxHash: multisig.safeTxHash,
          originName: 'App',
          originUrl: 'https://app.example',
          notes: 'a note',
        }),
      ]);

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(result.results[0]).toMatchObject({
        safeTxHash: multisig.safeTxHash,
        origin: buildOrigin('App', 'https://app.example', 'a note'),
      });
    });

    it('should keep tx-service origin when the queue record has only a note (no name/url)', async () => {
      const multisig = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', buildOrigin('TxName', 'https://tx.example'))
        .build();

      const page = pageBuilder<unknown>()
        .with('results', [multisigTransactionToJson(multisig)])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getAllTransactions.mockResolvedValue(rawify(page));
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        buildQueueEntityForSafe({
          safeTxHash: multisig.safeTxHash,
          originName: null,
          originUrl: null,
          notes: 'a note',
        }),
      ]);

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(result.results[0]).toMatchObject({
        safeTxHash: multisig.safeTxHash,
        origin: buildOrigin('TxName', 'https://tx.example'),
      });
    });

    it('should leave non-multisig entries (ethereum, module) untouched', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        buildQueueEntityForSafe({
          safeTxHash: multisig.safeTxHash,
          originName: 'App',
          originUrl: 'https://app.example',
        }),
      ]);

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(
        mockSafeQueueService.getMultisigTransactionsBatch,
      ).toHaveBeenCalledTimes(1);
      expect(
        mockSafeQueueService.getMultisigTransactionsBatch,
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

    it('should fall back to tx-service origin for hashes the batch response omits', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        buildQueueEntityForSafe({
          safeTxHash: multisigOk.safeTxHash,
          originName: 'AppOk',
          originUrl: 'https://ok.example',
        }),
      ]);

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

    it('should keep tx-service origin on every entry when the batch call fails', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockRejectedValue(
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

    it('should skip queue-service calls entirely when the page has no multisig entries', async () => {
      const ethereum = ethereumTransactionBuilder().build();

      const page = pageBuilder<unknown>()
        .with('results', [ethereumTransactionToJson(ethereum)])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getAllTransactions.mockResolvedValue(rawify(page));

      await repository.getTransactionHistory({ chainId, safeAddress });

      expect(
        mockSafeQueueService.getMultisigTransactionsBatch,
      ).not.toHaveBeenCalled();
    });

    it('should preserve the tx-service origin when the queue record has no originName and no originUrl', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        buildQueueEntityForSafe({
          safeTxHash: multisig.safeTxHash,
          originName: null,
          originUrl: null,
        }),
      ]);

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      // An empty queue origin (e.g. a not-yet-backfilled entry) must not clobber
      // the existing tx-service origin.
      expect(result.results[0]).toMatchObject({
        safeTxHash: multisig.safeTxHash,
        origin: 'tx-service-origin',
      });
    });

    it('should not treat a sanitized (null) queue origin URL as leaked', async () => {
      // getMultisigTransactionsBatch validates and sanitizes malicious
      // protocols (e.g. javascript:) to null before this repository ever
      // sees the data — see SafeQueueService's own coverage for that. This
      // only asserts the repository correctly overlays a name-only origin.
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        buildQueueEntityForSafe({
          safeTxHash: multisig.safeTxHash,
          originName: 'Evil',
          originUrl: null,
        }),
      ]);

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      const origin = (result.results[0] as { origin: string | null }).origin;
      expect(origin).not.toBeNull();
      expect(origin).not.toContain('javascript');
      expect(JSON.parse(origin as string).url).toBeNull();
      expect(JSON.parse(origin as string).name).toBe('Evil');
    });

    it('should drop the override when the queue record reports a different chainId', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        safeQueueMultisigTransactionBuilder()
          .with('chainId', `${Number(chainId) + 1}`)
          .with('safe', safeAddress)
          .with('safeTxHash', multisig.safeTxHash)
          .with('originName', 'CrossChain')
          .with('originUrl', 'https://crosschain.example')
          .build(),
      ]);

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(result.results[0]).toMatchObject({ origin: 'tx-service-origin' });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Queue origin reconciliation rejected'),
      );
    });

    it('should drop the override when the queue record reports a different safe', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        safeQueueMultisigTransactionBuilder()
          .with('chainId', chainId)
          .with('safe', getAddress(faker.finance.ethereumAddress()))
          .with('safeTxHash', multisig.safeTxHash)
          .with('originName', 'WrongSafe')
          .with('originUrl', 'https://wrongsafe.example')
          .build(),
      ]);

      const result = await repository.getTransactionHistory({
        chainId,
        safeAddress,
      });

      expect(result.results[0]).toMatchObject({ origin: 'tx-service-origin' });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Queue origin reconciliation rejected'),
      );
    });
  });

  describe('getMultiSigTransaction', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('should override origin with the queue-service value', async () => {
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockSafeQueueService.getMultisigTransaction.mockResolvedValue(
        rawify(
          safeQueueMultisigTransactionBuilder()
            .with('chainId', chainId)
            .with('safe', safeAddress)
            .with('safeTxHash', tx.safeTxHash)
            .with('originName', 'App')
            .with('originUrl', 'https://app.example')
            .build(),
        ),
      );

      const result = await repository.getMultiSigTransaction({
        chainId,
        safeTransactionHash: tx.safeTxHash,
      });

      expect(result.origin).toBe(buildOrigin('App', 'https://app.example'));
      expect(mockSafeQueueService.getMultisigTransaction).toHaveBeenCalledWith({
        chainId,
        safeTxHash: tx.safeTxHash,
      });
    });

    it('should preserve the queue note in the executed-tx origin overlay', async () => {
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockSafeQueueService.getMultisigTransaction.mockResolvedValue(
        rawify(
          safeQueueMultisigTransactionBuilder()
            .with('chainId', chainId)
            .with('safe', safeAddress)
            .with('safeTxHash', tx.safeTxHash)
            .with('originName', 'App')
            .with('originUrl', 'https://app.example')
            .with('notes', 'a note')
            .build(),
        ),
      );

      const result = await repository.getMultiSigTransaction({
        chainId,
        safeTransactionHash: tx.safeTxHash,
      });

      expect(result.origin).toBe(
        buildOrigin('App', 'https://app.example', 'a note'),
      );
    });

    it('should keep tx-service origin when the queue call fails', async () => {
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockSafeQueueService.getMultisigTransaction.mockRejectedValue(
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

    it('should drop the override when the queue record reports a different chainId or safe', async () => {
      const tx = multisigTransactionBuilder()
        .with('safe', safeAddress)
        .with('origin', 'tx-service-origin')
        .build();
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockSafeQueueService.getMultisigTransaction.mockResolvedValue(
        rawify(
          safeQueueMultisigTransactionBuilder()
            .with('chainId', `${Number(chainId) + 1}`)
            .with('safe', getAddress(faker.finance.ethereumAddress()))
            .with('safeTxHash', tx.safeTxHash)
            .with('originName', 'CrossChain')
            .with('originUrl', 'https://crosschain.example')
            .build(),
        ),
      );

      const result = await repository.getMultiSigTransaction({
        chainId,
        safeTransactionHash: tx.safeTxHash,
      });

      expect(result.origin).toBe('tx-service-origin');
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Queue origin reconciliation rejected'),
      );
    });

    it('should skip the queue call entirely when FF_SAFE_QUEUE_SERVICE is off', async () => {
      const repo = createRepository({ safeQueueEnabled: false });
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
      expect(
        mockSafeQueueService.getMultisigTransaction,
      ).not.toHaveBeenCalled();
    });

    it('should use the queue transaction as the source of truth when it is not executed', async () => {
      const safe = safeBuilder().with('address', safeAddress).build();
      const queueTx = safeQueueMultisigTransactionBuilder()
        .with('chainId', chainId)
        .with('safe', safeAddress)
        .with('txHash', null)
        .with('originName', 'App')
        .with('originUrl', 'https://app.example')
        .build();
      mockSafeQueueService.getMultisigTransaction.mockResolvedValue(
        rawify(queueTx),
      );
      mockTransactionApi.getSafe.mockResolvedValue(rawify(safe));

      const result = await repository.getMultiSigTransaction({
        chainId,
        safeTransactionHash: queueTx.safeTxHash,
      });

      expect(result.isExecuted).toBe(false);
      expect(result.safeTxHash).toBe(queueTx.safeTxHash);
      expect(result.origin).toBe(buildOrigin('App', 'https://app.example'));
      expect(result.confirmationsRequired).toBe(safe.threshold);
      expect(mockTransactionApi.getMultisigTransaction).not.toHaveBeenCalled();
    });
  });

  describe('getMultisigTransactions', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('should override origin on each entry from the batch response', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        safeQueueMultisigTransactionBuilder()
          .with('chainId', chainId)
          .with('safe', safeAddress)
          .with('safeTxHash', txA.safeTxHash)
          .with('originName', 'AppA')
          .with('originUrl', 'https://a.example')
          .build(),
        safeQueueMultisigTransactionBuilder()
          .with('chainId', chainId)
          .with('safe', safeAddress)
          .with('safeTxHash', txB.safeTxHash)
          .with('originName', 'AppB')
          .with('originUrl', 'https://b.example')
          .build(),
      ]);

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
        mockSafeQueueService.getMultisigTransactionsBatch,
      ).toHaveBeenCalledWith({
        chainId,
        safeTxHashes: [txA.safeTxHash, txB.safeTxHash],
      });
    });

    it('should keep tx-service origin for hashes the batch omits', async () => {
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
      mockSafeQueueService.getMultisigTransactionsBatch.mockResolvedValue([
        safeQueueMultisigTransactionBuilder()
          .with('chainId', chainId)
          .with('safe', safeAddress)
          .with('safeTxHash', txKept.safeTxHash)
          .with('originName', 'AppKept')
          .with('originUrl', 'https://kept.example')
          .build(),
      ]);

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

    it('should skip the queue call entirely when FF_SAFE_QUEUE_SERVICE is off', async () => {
      const repo = createRepository({ safeQueueEnabled: false });
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
        mockSafeQueueService.getMultisigTransactionsBatch,
      ).not.toHaveBeenCalled();
    });
  });

  describe('deleteTransaction', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('should clear both tx-service and queue caches when FF_SAFE_QUEUE_SERVICE is on', async () => {
      const tx = multisigTransactionBuilder().with('safe', safeAddress).build();
      const signature = faker.string.hexadecimal({ length: 16 });
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockSafeQueueService.deleteTransaction.mockResolvedValue(undefined);

      await repository.deleteTransaction({
        chainId,
        safeTxHash: tx.safeTxHash,
        signature,
      });

      expect(mockSafeQueueService.deleteTransaction).toHaveBeenCalledWith({
        chainId,
        safeTxHash: tx.safeTxHash,
        signature,
      });
      expect(mockTransactionApi.deleteTransaction).not.toHaveBeenCalled();
      expect(mockTransactionApi.clearMultisigTransaction).toHaveBeenCalledWith(
        tx.safeTxHash,
      );
      expect(mockTransactionApi.clearMultisigTransactions).toHaveBeenCalledWith(
        tx.safe,
      );
      expect(
        mockSafeQueueService.clearMultisigTransaction,
      ).toHaveBeenCalledWith({
        chainId,
        safeTxHash: tx.safeTxHash,
      });
      expect(mockSafeQueueService.clearAllTransactions).toHaveBeenCalledWith({
        chainId,
        safeAddress: tx.safe,
      });
    });

    it('should only clear tx-service cache when FF_SAFE_QUEUE_SERVICE is off', async () => {
      const repo = createRepository({ safeQueueEnabled: false });
      const tx = multisigTransactionBuilder().with('safe', safeAddress).build();
      const signature = faker.string.hexadecimal({ length: 16 });
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockTransactionApi.deleteTransaction.mockResolvedValue(undefined);

      await repo.deleteTransaction({
        chainId,
        safeTxHash: tx.safeTxHash,
        signature,
      });

      expect(mockTransactionApi.deleteTransaction).toHaveBeenCalledWith({
        chainId,
        safeTxHash: tx.safeTxHash,
        signature,
      });
      expect(mockSafeQueueService.deleteTransaction).not.toHaveBeenCalled();
      expect(mockTransactionApi.clearMultisigTransaction).toHaveBeenCalledWith(
        tx.safeTxHash,
      );
      expect(mockTransactionApi.clearMultisigTransactions).toHaveBeenCalledWith(
        tx.safe,
      );
      expect(
        mockSafeQueueService.clearMultisigTransaction,
      ).not.toHaveBeenCalled();
      expect(mockSafeQueueService.clearAllTransactions).not.toHaveBeenCalled();
    });

    it('should invalidate the queue cache so executed/deleted transactions disappear from the queue', async () => {
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await repository.clearMultisigTransactions({ chainId, safeAddress });

      expect(mockTransactionApi.clearMultisigTransactions).toHaveBeenCalledWith(
        safeAddress,
      );
      expect(mockSafeQueueService.clearAllTransactions).toHaveBeenCalledWith({
        chainId,
        safeAddress,
      });
    });

    it('should only clear the tx-service cache when FF_SAFE_QUEUE_SERVICE is off (clearMultisigTransactions)', async () => {
      const repo = createRepository({ safeQueueEnabled: false });
      const safeAddress = getAddress(faker.finance.ethereumAddress());

      await repo.clearMultisigTransactions({ chainId, safeAddress });

      expect(mockTransactionApi.clearMultisigTransactions).toHaveBeenCalledWith(
        safeAddress,
      );
      expect(mockSafeQueueService.clearAllTransactions).not.toHaveBeenCalled();
    });

    it('should warn with chainId, safeTxHash and error when fire-and-forget cache clear fails', async () => {
      const tx = multisigTransactionBuilder().with('safe', safeAddress).build();
      const signature = faker.string.hexadecimal({ length: 16 });
      mockTransactionApi.getMultisigTransaction.mockResolvedValue(
        rawify(multisigTransactionToJson(tx)),
      );
      mockSafeQueueService.deleteTransaction.mockResolvedValue(undefined);
      mockSafeQueueService.clearMultisigTransaction.mockRejectedValue(
        new Error('cache down'),
      );

      await repository.deleteTransaction({
        chainId,
        safeTxHash: tx.safeTxHash,
        signature,
      });
      // Flush microtasks so the fire-and-forget cache-clear chain runs
      await new Promise((resolve) => setImmediate(resolve));

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        `Failed to immediately clear deleted transaction from cache. chainId=${chainId}, safeTxHash=${tx.safeTxHash}, error=Error: Failed to clear multisig transaction`,
      );
      // The underlying cause is preserved in the repository-level debug log
      expect(mockLoggingService.debug).toHaveBeenCalledWith(
        `Failed to clear multisig transaction from one or more caches. errors=Error: cache down`,
      );
    });
  });

  describe('proposeTransaction', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('should propose via the queue service without explicitly clearing the queue cache (relies on TTL/upstream)', async () => {
      const safe = safeBuilder().with('address', safeAddress).build();
      const proposeTransactionDto = proposeTransactionDtoBuilder().build();
      mockTransactionApi.getSafe.mockResolvedValue(rawify(safe));
      mockTransactionApi.getMultisigTransactionWithNoCache.mockRejectedValue(
        new Error('not found'),
      );
      mockSafeQueueService.proposeTransaction.mockResolvedValue(rawify({}));

      await repository.proposeTransaction({
        chainId,
        safeAddress,
        proposeTransactionDto,
      });

      expect(mockSafeQueueService.proposeTransaction).toHaveBeenCalledWith({
        chainId,
        safeAddress,
        proposeTransactionDto,
      });
      expect(mockSafeQueueService.clearAllTransactions).not.toHaveBeenCalled();
      expect(
        mockSafeQueueService.clearMultisigTransaction,
      ).not.toHaveBeenCalled();
    });

    it('should not touch the queue cache when FF_SAFE_QUEUE_SERVICE is off', async () => {
      const repo = createRepository({ safeQueueEnabled: false });
      const safe = safeBuilder().with('address', safeAddress).build();
      const proposeTransactionDto = proposeTransactionDtoBuilder().build();
      mockTransactionApi.getSafe.mockResolvedValue(rawify(safe));
      mockTransactionApi.getMultisigTransactionWithNoCache.mockRejectedValue(
        new Error('not found'),
      );
      mockTransactionApi.deleteTransaction.mockResolvedValue(undefined);

      await repo.proposeTransaction({
        chainId,
        safeAddress,
        proposeTransactionDto,
      });

      expect(mockSafeQueueService.proposeTransaction).not.toHaveBeenCalled();
      expect(mockSafeQueueService.clearAllTransactions).not.toHaveBeenCalled();
      expect(
        mockSafeQueueService.clearMultisigTransaction,
      ).not.toHaveBeenCalled();
    });
  });

  describe('addConfirmation', () => {
    const chainId = faker.string.numeric();
    const safeAddress = getAddress(faker.finance.ethereumAddress());

    it('should post the confirmation to the queue service and clear the transaction cache it primed', async () => {
      const safe = safeBuilder().with('address', safeAddress).build();
      const queueTx = safeQueueMultisigTransactionBuilder()
        .with('chainId', chainId)
        .with('safe', safeAddress)
        .with('txHash', null)
        .build();
      mockSafeQueueService.getMultisigTransaction.mockResolvedValue(
        rawify(queueTx),
      );
      mockTransactionApi.getSafe.mockResolvedValue(rawify(safe));
      mockSafeQueueService.postConfirmation.mockResolvedValue(rawify({}));

      await repository.addConfirmation({
        chainId,
        safeTxHash: queueTx.safeTxHash,
        addConfirmationDto: {
          signature: getAddress(faker.finance.ethereumAddress()),
        },
      });

      expect(mockSafeQueueService.postConfirmation).toHaveBeenCalled();
      expect(
        mockSafeQueueService.clearMultisigTransaction,
      ).toHaveBeenCalledWith({
        chainId,
        safeTxHash: queueTx.safeTxHash,
      });
      expect(mockTransactionApi.clearMultisigTransaction).toHaveBeenCalledWith(
        queueTx.safeTxHash,
      );
    });
  });
});
