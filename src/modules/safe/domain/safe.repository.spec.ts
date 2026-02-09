import { SafeRepository } from '@/modules/safe/domain/safe.repository';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IChainsRepository } from '@/modules/chains/domain/chains.repository.interface';
import type { TransactionVerifierHelper } from '@/modules/transactions/routes/helpers/transaction-verifier.helper';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import { faker } from '@faker-js/faker';
import type { Address } from 'viem';
import { getAddress } from 'viem';
import { SAFE_TRANSACTION_SERVICE_MAX_LIMIT } from '@/domain/common/constants';
import { chainBuilder } from '@/modules/chains/domain/entities/__tests__/chain.builder';
import { rawify } from '@/validation/entities/raw.entity';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import type { SafeV2 } from '@/modules/safe/domain/entities/safe.entity';
import { DataSourceError } from '@/domain/errors/data-source.error';

const mockTransactionApiManager = {
  getApi: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApiManager>;

const mockTransactionApi = {
  getSafesByOwnerV2: jest.fn(),
} as jest.MockedObjectDeep<ITransactionApi>;

const mockLoggingService = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

const mockChainsRepository = {
  getAllChains: jest.fn(),
} as jest.MockedObjectDeep<IChainsRepository>;

const mockTransactionVerifier = {
  verifyApiTransaction: jest.fn(),
  verifyConfirmation: jest.fn(),
  verifyProposal: jest.fn(),
} as jest.MockedObjectDeep<TransactionVerifierHelper>;

const mockConfigurationService = {
  getOrThrow: jest.fn(),
} as jest.MockedObjectDeep<IConfigurationService>;

describe('SafeRepository', () => {
  let repository: SafeRepository;
  const maxSequentialPages = 5;

  beforeEach(() => {
    jest.resetAllMocks();
    mockConfigurationService.getOrThrow.mockImplementation((key: string) => {
      if (key === 'safeConfig.safes.maxSequentialPages') {
        return maxSequentialPages;
      }
      throw new Error(`Unexpected key: ${key}`);
    });
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);

    repository = new SafeRepository(
      mockTransactionApiManager,
      mockLoggingService,
      mockChainsRepository,
      mockTransactionVerifier,
      mockConfigurationService,
    );
  });

  describe('getSafesByOwnerV3', () => {
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

    it('should return safes as a map from a single page', async () => {
      const safes = [createSafeV2(), createSafeV2()];
      const page = pageBuilder<SafeV2>()
        .with('results', safes)
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2.mockResolvedValue(rawify(page));

      const result = await repository.getSafesByOwnerV3({
        chainId,
        ownerAddress,
      });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(1);
      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledWith({
        ownerAddress,
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        offset: 0,
      });
      expect(result).toEqual(
        Object.fromEntries(safes.map((safe) => [safe.address, safe])),
      );
      expect(mockLoggingService.error).not.toHaveBeenCalled();
    });

    it('should handle empty results', async () => {
      const page = pageBuilder<SafeV2>()
        .with('results', [])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2.mockResolvedValue(rawify(page));

      const result = await repository.getSafesByOwnerV3({
        chainId,
        ownerAddress,
      });

      expect(result).toEqual({});
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

      const result = await repository.getSafesByOwnerV3({
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
      expect(result).toEqual(
        Object.fromEntries(allSafes.map((safe) => [safe.address, safe])),
      );
    });

    it('should handle max sequential pages limit', async () => {
      const baseUrl = 'https://example.com/api/v2/owners/safes/';

      // Create pages that exceed maxSequentialPages, each with a unique safe
      const pages = Array.from({ length: maxSequentialPages + 1 }, (_, i) => {
        const safe = createSafeV2();
        return pageBuilder<SafeV2>()
          .with('results', [safe])
          .with(
            'next',
            i < maxSequentialPages
              ? `${baseUrl}?limit=${SAFE_TRANSACTION_SERVICE_MAX_LIMIT}&offset=${(i + 1) * SAFE_TRANSACTION_SERVICE_MAX_LIMIT}`
              : null,
          )
          .with('previous', null)
          .build();
      });

      pages.forEach((page) => {
        mockTransactionApi.getSafesByOwnerV2.mockResolvedValueOnce(
          rawify(page),
        );
      });

      const result = await repository.getSafesByOwnerV3({
        chainId,
        ownerAddress,
      });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(
        maxSequentialPages,
      );
      expect(mockLoggingService.error).toHaveBeenCalledWith(
        `Max sequential pages reached for getSafesByOwnerV3. chainId=${chainId}, ownerAddress=${ownerAddress}`,
      );
      expect(Object.keys(result)).toHaveLength(maxSequentialPages);
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

      await repository.getSafesByOwnerV3({
        chainId,
        ownerAddress,
      });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenNthCalledWith(2, {
        ownerAddress,
        limit: SAFE_TRANSACTION_SERVICE_MAX_LIMIT,
        offset: customOffset,
      });
    });

    it('should handle 404 errors by returning empty map', async () => {
      const error = new DataSourceError('Not found', 404);

      mockTransactionApi.getSafesByOwnerV2.mockRejectedValue(error);

      const result = await repository.getSafesByOwnerV3({
        chainId,
        ownerAddress,
      });

      expect(result).toEqual({});
    });

    it('should handle API errors', async () => {
      const error = new Error('API error');
      mockTransactionApi.getSafesByOwnerV2.mockRejectedValue(error);

      await expect(
        repository.getSafesByOwnerV3({
          chainId,
          ownerAddress,
        }),
      ).rejects.toThrow('API error');
    });

    it('should handle null guard and moduleGuard', async () => {
      const safe = {
        address: getAddress(faker.finance.ethereumAddress()),
        owners: [getAddress(faker.finance.ethereumAddress())],
        threshold: faker.number.int({ min: 1 }),
        nonce: faker.number.int({ min: 0 }),
        masterCopy: getAddress(faker.finance.ethereumAddress()),
        fallbackHandler: getAddress(faker.finance.ethereumAddress()),
        guard: null,
        moduleGuard: null,
        enabledModules: [],
      };
      const page = pageBuilder<SafeV2>()
        .with('results', [safe])
        .with('next', null)
        .with('previous', null)
        .build();

      mockTransactionApi.getSafesByOwnerV2.mockResolvedValue(rawify(page));

      const result = await repository.getSafesByOwnerV3({
        chainId,
        ownerAddress,
      });

      expect(result).toEqual({
        [safe.address]: safe,
      });
    });
  });

  describe('getAllSafesByOwnerV3', () => {
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

    it('should return safes from several chains as maps', async () => {
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

      const result = await repository.getAllSafesByOwnerV3({ ownerAddress });

      expect(mockChainsRepository.getAllChains).toHaveBeenCalledTimes(1);
      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        '1': Object.fromEntries(
          safesChain1.map((safe) => [safe.address, safe]),
        ),
        '137': Object.fromEntries(
          safesChain2.map((safe) => [safe.address, safe]),
        ),
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

      const result = await repository.getAllSafesByOwnerV3({ ownerAddress });

      expect(result).toEqual({
        '1': Object.fromEntries(
          safesChain1.map((safe) => [safe.address, safe]),
        ),
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
      mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
      mockTransactionApi.getSafesByOwnerV2.mockRejectedValue(error);

      const result = await repository.getAllSafesByOwnerV3({ ownerAddress });

      expect(result).toEqual({
        '1': null,
        '137': null,
      });
      expect(mockLoggingService.warn).toHaveBeenCalledTimes(2);
    });

    it('should handle empty chains list', async () => {
      mockChainsRepository.getAllChains.mockResolvedValue([]);

      const result = await repository.getAllSafesByOwnerV3({ ownerAddress });

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

      const result = await repository.getAllSafesByOwnerV3({ ownerAddress });

      expect(mockTransactionApi.getSafesByOwnerV2).toHaveBeenCalledTimes(2);
      const allSafes = [...safesPage1, ...safesPage2];
      expect(result).toEqual({
        '1': Object.fromEntries(allSafes.map((safe) => [safe.address, safe])),
      });
    });

    it('should handle errors from getAllChains', async () => {
      const error = new Error('Failed to get chains');
      mockChainsRepository.getAllChains.mockRejectedValue(error);

      await expect(
        repository.getAllSafesByOwnerV3({ ownerAddress }),
      ).rejects.toThrow('Failed to get chains');
    });
  });
});
