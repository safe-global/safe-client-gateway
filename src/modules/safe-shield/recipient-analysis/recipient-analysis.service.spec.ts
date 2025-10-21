import { RecipientAnalysisService } from './recipient-analysis.service';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Transfer } from '@/domain/safe/entities/transfer.entity';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import type { IChainsRepository } from '@/domain/chains/chains.repository.interface';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import * as utils from '../utils/recipient-extraction.utils';
import { chainBuilder } from '@/domain/chains/entities/__tests__/chain.builder';
import { safeBuilder } from '@/domain/safe/entities/__tests__/safe.builder';
import type { TransactionsService } from '@/routes/transactions/transactions.service';
import { TransactionInfoType } from '@/routes/transactions/entities/transaction-info.entity';
import type { BridgeAndSwapTransactionInfo } from '@/routes/transactions/entities/bridge/bridge-info.entity';
import type { Address, Hash, Hex } from 'viem';
import type { DataDecodedAccuracy } from '@/domain/data-decoder/v2/entities/data-decoded.entity';
import type { CreationTransaction } from '@/routes/transactions/entities/creation-transaction.entity';
import type { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import { FakeCacheService } from '@/datasources/cache/__tests__/fake.cache.service';
import { CacheRouter } from '@/datasources/cache/cache.router';
import { createHash } from 'crypto';
import { rawify } from '@/validation/entities/raw.entity';

describe('RecipientAnalysisService', () => {
  const mockTransactionApi = {
    getTransfers: jest.fn(),
    getSafe: jest.fn(),
  } as jest.MockedObjectDeep<ITransactionApi>;

  const mockTransactionApiManager = {
    getApi: jest.fn().mockResolvedValue(mockTransactionApi),
  } as jest.MockedObjectDeep<ITransactionApiManager>;

  const mockErc20Decoder = {
    helpers: {
      isTransfer: jest.fn(),
      isTransferFrom: jest.fn(),
    },
  } as jest.MockedObjectDeep<Erc20Decoder>;

  const mockConfigurationService = {
    getOrThrow: jest.fn().mockReturnValue(3600), // Default cache expiration
  } as jest.MockedObjectDeep<IConfigurationService>;

  const fakeCacheService = new FakeCacheService();

  const mockLoggingService = {
    debug: jest.fn(),
    warn: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>;

  const mockChainsRepository = {
    getAllChains: jest.fn(),
    isSupportedChain: jest.fn(),
    getChain: jest.fn(),
  } as jest.MockedObjectDeep<IChainsRepository>;

  const mockTransactionsService = {
    getCreationTransaction: jest.fn(),
  } as jest.MockedObjectDeep<TransactionsService>;

  const service = new RecipientAnalysisService(
    mockTransactionApiManager,
    mockErc20Decoder,
    mockConfigurationService,
    fakeCacheService,
    mockLoggingService,
    mockChainsRepository,
    mockTransactionsService,
  );

  const extractRecipientsSpy = jest.spyOn(utils, 'extractRecipients');

  const mockChainId = faker.string.numeric(3); // Random chain ID
  const mockSafeAddress = getAddress(faker.finance.ethereumAddress());
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());

  const createMockTxInfo = (
    recipient: string,
    toChain: string,
  ): BridgeAndSwapTransactionInfo =>
    ({
      type: TransactionInfoType.SwapAndBridge,
      recipient: { value: recipient as Address },
      toChain,
      humanDescription: 'Bridge transaction',
    }) as BridgeAndSwapTransactionInfo;

  const createMockParameters = (
    owners: Array<string>,
    threshold: number = 1,
  ): Array<{
    name: string;
    type: string;
    value: string | number | Array<string>;
  }> => [
    { name: 'owners', type: 'address[]', value: owners },
    { name: 'threshold', type: 'uint256', value: threshold },
    {
      name: 'to',
      type: 'address',
      value: faker.finance.ethereumAddress(),
    },
    { name: 'data', type: 'bytes', value: '0x' },
    {
      name: 'fallbackHandler',
      type: 'address',
      value: faker.finance.ethereumAddress(),
    },
    {
      name: 'paymentToken',
      type: 'address',
      value: faker.finance.ethereumAddress(),
    },
    {
      name: 'payment',
      type: 'uint256',
      value: faker.number.int({ min: 0, max: 1000 }),
    },
    {
      name: 'paymentReceiver',
      type: 'address',
      value: faker.finance.ethereumAddress(),
    },
  ];

  const createMockCreationTransaction = (
    owners: Array<string>,
    threshold: number = 1,
  ): CreationTransaction =>
    ({
      created: faker.date.recent(),
      creator: faker.finance.ethereumAddress() as Address,
      transactionHash: faker.string.hexadecimal({
        length: 64,
        prefix: '0x',
      }) as Hash,
      masterCopy: faker.finance.ethereumAddress() as Address,
      factoryAddress: faker.finance.ethereumAddress() as Address,
      setupData: faker.string.hexadecimal({ length: 10, prefix: '0x' }) as Hex,
      saltNonce: faker.string.hexadecimal({ length: 8, prefix: '0x' }),
      dataDecoded: {
        method: 'setup',
        parameters: createMockParameters(owners, threshold),
        accuracy: faker.helpers.arrayElement([
          'FULL_MATCH',
          'PARTIAL_MATCH',
          'ONLY_FUNCTION_MATCH',
          'NO_MATCH',
          'UNKNOWN',
        ]) as (typeof DataDecodedAccuracy)[number],
      } as DataDecoded,
    }) as CreationTransaction;

  const getRandomSafeVersion = (): string =>
    faker.helpers.arrayElement(['1.0.0', '1.1.1', '1.2.0', '1.3.0', '1.4.1']);

  beforeEach(() => {
    jest.resetAllMocks();
    fakeCacheService.clear();
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
  });

  const mockTransferPage = (count: number | null): Page<Transfer> =>
    pageBuilder<Transfer>().with('count', count).with('results', []).build();

  describe('analyze', () => {
    it('should handle analyze with txInfo parameter', async () => {
      const mockTxInfo = createMockTxInfo(
        mockRecipientAddress, // Use different recipient to avoid bridge analysis
        faker.string.numeric(3),
      );

      extractRecipientsSpy.mockReturnValue([mockRecipientAddress]);
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(faker.number.int({ min: 1, max: 5 })),
      );

      const transactions: Array<DecodedTransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: '1000000000000000000',
          data: '0x',
          dataDecoded: null,
        },
      ];

      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions,
        txInfo: mockTxInfo,
      });

      expect(result).toBeDefined();
      expect(Object.keys(result)).toContain(mockRecipientAddress);
    });

    it('should analyze multiple transactions and return results for each unique recipient', async () => {
      const recipient1 = getAddress(faker.finance.ethereumAddress());
      const recipient2 = getAddress(faker.finance.ethereumAddress());

      const transactions: Array<DecodedTransactionData> = [
        {
          operation: 0,
          to: recipient1,
          value: '1000000000000000000',
          data: '0x',
          dataDecoded: null,
        },
        {
          operation: 0,
          to: recipient2,
          value: '2000000000000000000',
          data: '0x',
          dataDecoded: null,
        },
        {
          operation: 0,
          to: recipient1, // Duplicate recipient
          value: '500000000000000000',
          data: '0x',
          dataDecoded: null,
        },
      ];

      extractRecipientsSpy.mockReturnValue([recipient1, recipient2]);
      (mockTransactionApi.getTransfers as jest.Mock)
        .mockResolvedValueOnce(mockTransferPage(5))
        .mockResolvedValueOnce(mockTransferPage(0));

      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions,
      });

      expect(Object.keys(result)).toHaveLength(2);
      expect(Object.keys(result)).toContain(recipient1);
      expect(Object.keys(result)).toContain(recipient2);

      const results = Object.values(result);
      const knownRecipientResult = results.find(
        (r) => r?.RECIPIENT_INTERACTION?.[0]?.type === 'RECURRING_RECIPIENT',
      );
      const newRecipientResult = results.find(
        (r) => r?.RECIPIENT_INTERACTION?.[0]?.type === 'NEW_RECIPIENT',
      );

      expect(knownRecipientResult).toEqual({
        RECIPIENT_INTERACTION: [
          {
            severity: 'OK',
            type: 'RECURRING_RECIPIENT',
            title: 'Recurring recipient',
            description: 'You have interacted with this address 5 times.',
          },
        ],
      });

      expect(newRecipientResult).toEqual({
        RECIPIENT_INTERACTION: [
          {
            severity: 'INFO',
            type: 'NEW_RECIPIENT',
            title: 'New recipient',
            description:
              'You are interacting with this address for the first time.',
          },
        ],
      });

      expect(mockTransactionApi.getTransfers).toHaveBeenCalledTimes(2);

      expect(extractRecipientsSpy).toHaveBeenCalledTimes(1);
      expect(extractRecipientsSpy).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
      );
    });

    it('should handle empty transactions array', async () => {
      extractRecipientsSpy.mockReturnValue([]);

      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [],
      });

      expect(result).toEqual({});
      expect(mockTransactionApi.getTransfers).not.toHaveBeenCalled();

      const cacheDir = CacheRouter.getRecipientAnalysisCacheDir({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipients: [],
      });
      const cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toStrictEqual({});

      expect(extractRecipientsSpy).toHaveBeenCalledTimes(1);
      expect(extractRecipientsSpy).toHaveBeenCalledWith([], mockErc20Decoder);
    });

    it('should return cached result when available', async () => {
      const mockTxInfo = createMockTxInfo(
        getAddress(faker.finance.ethereumAddress()),
        faker.string.numeric(3),
      );

      // First run to populate cache
      extractRecipientsSpy.mockReturnValue([mockRecipientAddress]);
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(3),
      );

      const transactions: Array<DecodedTransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: '1000000000000000000',
          data: '0x',
          dataDecoded: null,
        },
      ];

      const firstResult = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions,
        txInfo: mockTxInfo,
      });

      // Reset mocks for second call
      jest.clearAllMocks();
      extractRecipientsSpy.mockReturnValue([mockRecipientAddress]);

      // Second run should use cache
      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual(firstResult);
      expect(mockTransactionApi.getTransfers).not.toHaveBeenCalled();
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'CACHE_HIT',
        key: expect.any(String),
        field: expect.any(String),
      });

      expect(extractRecipientsSpy).toHaveBeenCalledTimes(1);
      expect(extractRecipientsSpy).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
      );
    });

    it('should cache result when not in cache', async () => {
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(faker.number.int({ min: 1, max: 5 })),
      );
      extractRecipientsSpy.mockReturnValue([mockRecipientAddress]);

      const transactions: Array<DecodedTransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: '1000000000000000000',
          data: '0x',
          dataDecoded: null,
        },
      ];

      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions,
      });

      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'CACHE_MISS',
        key: expect.any(String),
        field: expect.any(String),
      });

      const cacheDir = CacheRouter.getRecipientAnalysisCacheDir({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipients: [mockRecipientAddress],
      });
      const cacheContent = await fakeCacheService.hGet(cacheDir);
      expect(JSON.parse(cacheContent as string)).toStrictEqual(
        expect.objectContaining(result),
      );

      expect(extractRecipientsSpy).toHaveBeenCalledTimes(1);
      expect(extractRecipientsSpy).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle Safe creation data parsing errors gracefully', async () => {
      const mockTxInfo = createMockTxInfo(
        mockSafeAddress,
        faker.string.numeric(3),
      );

      mockTransactionsService.getCreationTransaction.mockResolvedValue({
        created: faker.date.recent(),
        creator: faker.finance.ethereumAddress() as Address,
        transactionHash: faker.string.hexadecimal({
          length: 64,
          prefix: '0x',
        }) as Hash,
        masterCopy: faker.finance.ethereumAddress() as Address,
        factoryAddress: faker.finance.ethereumAddress() as Address,
        setupData: '0x' as Hex, // Invalid setup data
        saltNonce: faker.string.hexadecimal({ length: 8, prefix: '0x' }),
        dataDecoded: null,
      });

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder().with('chainId', faker.string.numeric(3)).build(),
      );

      const mockSourceSafe = safeBuilder()
        .with('version', getRandomSafeVersion())
        .with('threshold', faker.number.int({ min: 1, max: 5 }))
        .with('owners', [getAddress(faker.finance.ethereumAddress())])
        .build();

      (mockTransactionApi.getSafe as jest.Mock).mockResolvedValue(
        mockSourceSafe,
      );

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({});
    });

    it('should handle getSafe errors gracefully', async () => {
      const targetChainId = faker.string.numeric(3);
      const mockTxInfo = createMockTxInfo(mockSafeAddress, targetChainId);

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);

      mockTransactionApiManager.getApi.mockImplementation((chainId) => {
        if (chainId === mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockRejectedValue(new Error('Network error')),
          });
        }
        return Promise.resolve({
          ...mockTransactionApi,
          getSafe: jest.fn().mockResolvedValue(null),
        });
      });

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({
        [mockSafeAddress]: {
          BRIDGE: [
            {
              type: 'FAILED',
              severity: 'CRITICAL',
              title: 'Analysis failed',
              description:
                'The analysis failed: bridge compatibility unavailable. Please try again later.',
              targetChainId,
            },
          ],
        },
      });
    });
  });

  describe('Safe Creation Data Parsing', () => {
    it('should parse owners array correctly', async () => {
      const mockTxInfo = createMockTxInfo(
        mockSafeAddress,
        faker.string.numeric(3),
      );
      const owner1 = getAddress(faker.finance.ethereumAddress());
      const owner2 = getAddress(faker.finance.ethereumAddress());

      mockTransactionsService.getCreationTransaction.mockResolvedValue(
        createMockCreationTransaction([owner1, owner2], 2),
      );

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder().with('chainId', faker.string.numeric(3)).build(),
      );

      const mockSourceSafe = safeBuilder()
        .with('version', getRandomSafeVersion())
        .with('threshold', faker.number.int({ min: 1, max: 5 }))
        .with('owners', [owner1, owner2])
        .build();

      (mockTransactionApi.getSafe as jest.Mock).mockResolvedValue(
        mockSourceSafe,
      );

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({});
    });

    it('should handle invalid owners parameter gracefully', async () => {
      const mockTxInfo = createMockTxInfo(
        mockSafeAddress,
        faker.string.numeric(3),
      );

      mockTransactionsService.getCreationTransaction.mockResolvedValue({
        created: faker.date.recent(),
        creator: faker.finance.ethereumAddress() as Address,
        transactionHash: faker.string.hexadecimal({
          length: 64,
          prefix: '0x',
        }) as Hash,
        masterCopy: faker.finance.ethereumAddress() as Address,
        factoryAddress: faker.finance.ethereumAddress() as Address,
        setupData: faker.string.hexadecimal({
          length: 10,
          prefix: '0x',
        }) as Hex,
        saltNonce: faker.string.hexadecimal({ length: 8, prefix: '0x' }),
        dataDecoded: {
          method: 'setup',
          parameters: [
            { name: 'owners', type: 'address[]', value: 'not-an-array' },
            {
              name: 'threshold',
              type: 'uint256',
              value: faker.number.int({ min: 1, max: 10 }),
            },
            {
              name: 'to',
              type: 'address',
              value: faker.finance.ethereumAddress(),
            },
            { name: 'data', type: 'bytes', value: '0x' },
            {
              name: 'fallbackHandler',
              type: 'address',
              value: faker.finance.ethereumAddress(),
            },
            {
              name: 'paymentToken',
              type: 'address',
              value: faker.finance.ethereumAddress(),
            },
            {
              name: 'payment',
              type: 'uint256',
              value: faker.number.int({ min: 0, max: 1000 }),
            },
            {
              name: 'paymentReceiver',
              type: 'address',
              value: faker.finance.ethereumAddress(),
            },
          ],
          accuracy: faker.helpers.arrayElement([
            'FULL_MATCH',
            'PARTIAL_MATCH',
            'ONLY_FUNCTION_MATCH',
            'NO_MATCH',
            'UNKNOWN',
          ]),
        },
      });

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder().with('chainId', faker.string.numeric(3)).build(),
      );

      const mockSourceSafe = safeBuilder()
        .with('version', getRandomSafeVersion())
        .with('threshold', faker.number.int({ min: 1, max: 5 }))
        .with('owners', [getAddress(faker.finance.ethereumAddress())])
        .build();

      (mockTransactionApi.getSafe as jest.Mock).mockResolvedValue(
        mockSourceSafe,
      );

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({});
    });
  });

  describe('analyzeInteractions', () => {
    it('should return RECURRING_RECIPIENT when interactions > 0', async () => {
      const interactionCount = faker.number.int({ min: 2, max: 10 });
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(interactionCount),
      );

      const result = await service.analyzeInteractions({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        severity: 'OK',
        type: 'RECURRING_RECIPIENT',
        title: 'Recurring recipient',
        description: `You have interacted with this address ${interactionCount} times.`,
      });

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(
        mockChainId,
      );
      expect(mockTransactionApi.getTransfers).toHaveBeenCalledWith({
        safeAddress: mockSafeAddress,
        to: mockRecipientAddress,
        limit: 1,
      });
    });

    it('should return NEW_RECIPIENT when interactions = 0', async () => {
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(0),
      );

      const result = await service.analyzeInteractions({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        severity: 'INFO',
        type: 'NEW_RECIPIENT',
        title: 'New recipient',
        description:
          'You are interacting with this address for the first time.',
      });
    });

    it('should handle null count', async () => {
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(null),
      );

      const result = await service.analyzeInteractions({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        severity: 'INFO',
        type: 'NEW_RECIPIENT',
        title: 'New recipient',
        description:
          'You are interacting with this address for the first time.',
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API connection failed');
      mockTransactionApi.getTransfers.mockRejectedValue(error);

      const result = await service.analyzeInteractions({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        type: 'FAILED',
        severity: 'CRITICAL',
        title: 'Analysis failed',
        description:
          'The analysis failed: recipient interactions unavailable. Please try again later.',
      });

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(
        mockChainId,
      );
    });

    it('should handle invalid transfer page response', async () => {
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue({
        invalidField: 'invalid',
      });

      const result = await service.analyzeInteractions({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        type: 'FAILED',
        severity: 'CRITICAL',
        title: 'Analysis failed',
        description:
          'The analysis failed: recipient interactions unavailable. Please try again later.',
      });
    });

    it('should handle large interaction counts correctly', async () => {
      const largeInteractionCount = faker.number.int({ min: 100, max: 1000 });
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(largeInteractionCount),
      );

      const result = await service.analyzeInteractions({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        severity: 'OK',
        type: 'RECURRING_RECIPIENT',
        title: 'Recurring recipient',
        description: `You have interacted with this address ${largeInteractionCount} times.`,
      });
    });
  });

  describe('Safe Setup Comparison', () => {
    it('should correctly compare Safe setups with same owners and threshold', async () => {
      const mockTxInfo = createMockTxInfo(
        mockSafeAddress,
        faker.string.numeric(3),
      );
      const owner1 = getAddress(faker.finance.ethereumAddress());
      const owner2 = getAddress(faker.finance.ethereumAddress());

      const sourceSafe = safeBuilder()
        .with('owners', [owner1, owner2])
        .with('threshold', 2)
        .build();

      const targetSafe = safeBuilder()
        .with('owners', [owner2, owner1]) // Same owners, different order
        .with('threshold', 2)
        .build();

      mockTransactionsService.getCreationTransaction.mockResolvedValue(
        createMockCreationTransaction([owner1, owner2], 2),
      );

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder().with('chainId', faker.string.numeric(3)).build(),
      );

      (mockTransactionApi.getSafe as jest.Mock).mockImplementation(
        (address) => {
          if (address === mockSafeAddress) {
            return Promise.resolve(sourceSafe);
          }
          return Promise.resolve(targetSafe);
        },
      );

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({});
    });

    it('should handle Safe setup comparison with different owners', async () => {
      const targetChainId = faker.string.numeric(3);
      const mockTxInfo = createMockTxInfo(mockSafeAddress, targetChainId);
      const owner1 = getAddress(faker.finance.ethereumAddress());
      const owner2 = getAddress(faker.finance.ethereumAddress());
      const owner3 = getAddress(faker.finance.ethereumAddress());

      const sourceSafe = safeBuilder()
        .with('owners', [owner1, owner2])
        .with('threshold', 2)
        .build();

      const targetSafe = safeBuilder()
        .with('owners', [owner1, owner3]) // Different owners
        .with('threshold', 2)
        .build();

      mockTransactionsService.getCreationTransaction.mockResolvedValue(
        createMockCreationTransaction([owner1, owner2], 2),
      );

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder().with('chainId', targetChainId).build(),
      );

      mockTransactionApiManager.getApi.mockImplementation((chainId) => {
        if (chainId === mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockResolvedValue(sourceSafe),
          });
        }
        if (chainId !== mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockResolvedValue(targetSafe),
          });
        }
        return Promise.resolve({
          ...mockTransactionApi,
          getSafe: jest.fn().mockResolvedValue(null),
        });
      });

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({
        [mockSafeAddress]: {
          BRIDGE: [
            {
              type: 'DIFFERENT_SAFE_SETUP',
              severity: 'INFO',
              title: 'Different setup',
              description:
                'Your Safe exists on the target chain but with a different configuration. Review carefully before proceeding. Funds sent may be inaccessible if the setup is incorrect.',
              targetChainId,
            },
          ],
        },
      });
    });

    it('should handle Safe setup comparison with different owner counts', async () => {
      const mockTxInfo = createMockTxInfo(
        mockSafeAddress,
        faker.string.numeric(3),
      );
      const owner1 = getAddress(faker.finance.ethereumAddress());
      const owner2 = getAddress(faker.finance.ethereumAddress());
      const owner3 = getAddress(faker.finance.ethereumAddress());

      const sourceSafe = safeBuilder()
        .with('owners', [owner1, owner2])
        .with('threshold', 2)
        .build();

      const targetSafe = safeBuilder()
        .with('owners', [owner1, owner2, owner3]) // Different owner count
        .with('threshold', 2)
        .build();

      mockTransactionsService.getCreationTransaction.mockResolvedValue(
        createMockCreationTransaction([owner1, owner2], 2),
      );

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder().with('chainId', faker.string.numeric(3)).build(),
      );

      mockTransactionApiManager.getApi.mockImplementation((chainId) => {
        if (chainId === mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockResolvedValue(sourceSafe),
          });
        }
        return Promise.resolve({
          ...mockTransactionApi,
          getSafe: jest.fn().mockResolvedValue(targetSafe),
        });
      });

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(Object.keys(result)).toContain(mockSafeAddress);
      expect(result[mockSafeAddress]?.BRIDGE?.[0]?.type).toBe(
        'DIFFERENT_SAFE_SETUP',
      );
    });

    it('should handle Safe setup comparison with different thresholds', async () => {
      const mockTxInfo = createMockTxInfo(
        mockSafeAddress,
        faker.string.numeric(3),
      );
      const owner1 = getAddress(faker.finance.ethereumAddress());
      const owner2 = getAddress(faker.finance.ethereumAddress());

      const sourceSafe = safeBuilder()
        .with('owners', [owner1, owner2])
        .with('threshold', 1)
        .build();

      const targetSafe = safeBuilder()
        .with('owners', [owner1, owner2]) // Same owners
        .with('threshold', 2) // Different threshold
        .build();

      mockTransactionsService.getCreationTransaction.mockResolvedValue(
        createMockCreationTransaction([owner1, owner2], 1),
      );

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder().with('chainId', faker.string.numeric(3)).build(),
      );

      mockTransactionApiManager.getApi.mockImplementation((chainId) => {
        if (chainId === mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockResolvedValue(sourceSafe),
          });
        }
        return Promise.resolve({
          ...mockTransactionApi,
          getSafe: jest.fn().mockResolvedValue(targetSafe),
        });
      });

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(Object.keys(result)).toContain(mockSafeAddress);
      expect(result[mockSafeAddress]?.BRIDGE?.[0]?.type).toBe(
        'DIFFERENT_SAFE_SETUP',
      );
    });
  });

  describe('analyzeBridge', () => {
    const mockSourceSafe = safeBuilder()
      .with('version', '1.3.0')
      .with('threshold', 2)
      .with('owners', [
        getAddress(faker.finance.ethereumAddress()),
        getAddress(faker.finance.ethereumAddress()),
      ])
      .build();

    const mockChains = [
      chainBuilder()
        .with('chainId', '1')
        .with('chainName', 'Ethereum Mainnet')
        .build(),
      chainBuilder()
        .with('chainId', '137')
        .with('chainName', 'Polygon')
        .build(),
      chainBuilder()
        .with('chainId', '42161')
        .with('chainName', 'Arbitrum One')
        .build(),
    ];

    beforeEach(() => {
      mockChainsRepository.getAllChains.mockResolvedValue(mockChains);
      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockTransactionApi.getSafe.mockResolvedValue(rawify(mockSourceSafe));
      mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    });

    it('should return MISSING_OWNERSHIP when target Safe does not exist but network is compatible', async () => {
      const targetChainId = faker.string.numeric(3);
      const mockTxInfo = createMockTxInfo(mockSafeAddress, targetChainId);

      mockTransactionApiManager.getApi.mockImplementation((chainId) => {
        if (chainId === mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockResolvedValue(mockSourceSafe),
          });
        }
        return Promise.resolve({
          ...mockTransactionApi,
          getSafe: jest.fn().mockResolvedValue(null),
        });
      });

      const compatibleCreationTransaction = {
        ...createMockCreationTransaction([mockSafeAddress], 1),
        masterCopy: '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552' as Address,
        factoryAddress: '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2' as Address,
      };
      mockTransactionsService.getCreationTransaction.mockResolvedValue(
        compatibleCreationTransaction,
      );

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder()
          .with('chainId', targetChainId)
          .with('l2', false) // L1 chain for compatibility
          .build(),
      );

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({
        [mockSafeAddress]: {
          BRIDGE: [
            {
              type: 'INCOMPATIBLE_SAFE',
              severity: 'CRITICAL',
              title: 'Incompatible Safe version',
              description:
                'This Safe account cannot be created on the destination chain. You will not be able to claim ownership of the same address. Funds sent may be inaccessible.',
              targetChainId,
            },
          ],
        },
      });
    });

    it('should handle JSON parsing errors in cached data gracefully', async () => {
      extractRecipientsSpy.mockReturnValue([mockRecipientAddress]);
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(3),
      );

      await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [
          {
            operation: 0,
            to: mockRecipientAddress,
            value: '1000000000000000000',
            data: '0x',
            dataDecoded: null,
          },
        ],
      });

      // Now manually corrupt the cached data
      const recipientsHash = createHash('sha256');
      recipientsHash.update([mockRecipientAddress].sort().join(','));
      const cacheDir = {
        key: `${mockChainId}_recipient_analysis_${mockSafeAddress}`,
        field: recipientsHash.digest('hex'),
      };
      await fakeCacheService.hSet(cacheDir, 'invalid json data', 3600);

      // Reset mocks
      jest.clearAllMocks();
      extractRecipientsSpy.mockReturnValue([mockRecipientAddress]);
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(3),
      );

      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [
          {
            operation: 0,
            to: mockRecipientAddress,
            value: '1000000000000000000',
            data: '0x',
            dataDecoded: null,
          },
        ],
      });

      expect(result).toBeDefined();
      expect(result[mockRecipientAddress]).toBeDefined();
      expect(result[mockRecipientAddress]?.RECIPIENT_INTERACTION).toBeDefined();

      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          'Failed to parse cached recipient analysis results',
        ),
      );

      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'CACHE_MISS',
        key: expect.any(String),
        field: expect.any(String),
      });

      expect(mockTransactionApi.getTransfers).toHaveBeenCalledWith({
        safeAddress: mockSafeAddress,
        to: mockRecipientAddress,
        limit: 1,
      });
    });

    it('should return empty object when txInfo is not provided', async () => {
      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
      });

      expect(result).toEqual({});
    });

    it('should return INCOMPATIBLE_SAFE when target Safe does not exist and target network is incompatible', async () => {
      const mockTxInfo = createMockTxInfo(
        mockSafeAddress,
        faker.string.numeric(3),
      );

      mockTransactionApiManager.getApi.mockImplementation((chainId) => {
        if (chainId === mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockResolvedValue(mockSourceSafe),
          });
        }
        if (chainId !== mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockResolvedValue(null),
          });
        }
        return Promise.resolve({
          ...mockTransactionApi,
          getSafe: jest.fn().mockResolvedValue(null),
        });
      });

      // Use a known compatible master copy and factory address
      const compatibleCreationTransaction = {
        ...createMockCreationTransaction([mockSafeAddress], 1),
        masterCopy: '0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552' as Address, // Known compatible address
        factoryAddress: '0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2' as Address, // Known compatible address
      };
      mockTransactionsService.getCreationTransaction.mockResolvedValue(
        compatibleCreationTransaction,
      );

      mockChainsRepository.isSupportedChain.mockResolvedValue(true);
      mockChainsRepository.getChain.mockResolvedValue(
        chainBuilder().with('chainId', faker.string.numeric(3)).build(),
      );

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(Object.keys(result)).toContain(mockSafeAddress);
      expect(result[mockSafeAddress]?.BRIDGE?.[0]?.type).toBe(
        'INCOMPATIBLE_SAFE',
      );
    });

    it('should return UNSUPPORTED_NETWORK when target chain is not supported', async () => {
      const unsupportedChainId = faker.string.numeric(3);
      const mockTxInfo = createMockTxInfo(mockSafeAddress, unsupportedChainId);

      mockChainsRepository.isSupportedChain.mockImplementation((chainId) => {
        return Promise.resolve(chainId !== unsupportedChainId);
      });

      mockTransactionsService.getCreationTransaction.mockResolvedValue(
        createMockCreationTransaction([mockSafeAddress], 1),
      );

      mockTransactionApiManager.getApi.mockImplementation((chainId) => {
        if (chainId === mockChainId) {
          return Promise.resolve({
            ...mockTransactionApi,
            getSafe: jest.fn().mockResolvedValue(mockSourceSafe),
          });
        }
        return Promise.resolve({
          ...mockTransactionApi,
          getSafe: jest.fn().mockResolvedValue(null),
        });
      });

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({
        [mockSafeAddress]: {
          BRIDGE: [
            {
              type: 'UNSUPPORTED_NETWORK',
              severity: 'WARN',
              title: 'Unsupported network',
              description:
                'app.safe.global does not support the network. Unless you have a wallet deployed there, we recommend not to bridge. Funds sent may be inaccessible.',
              targetChainId: unsupportedChainId,
            },
          ],
        },
      });
    });

    it('should analyze recipient when bridge recipient is different from safe address', async () => {
      const differentRecipient = getAddress(faker.finance.ethereumAddress());
      const mockTxInfo = createMockTxInfo(
        differentRecipient,
        faker.string.numeric(3),
      );

      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(faker.number.int({ min: 1, max: 5 })),
      );

      mockTransactionApiManager.getApi.mockImplementation(() => {
        return Promise.resolve({
          ...mockTransactionApi,
          getSafe: jest.fn().mockResolvedValue(mockSourceSafe),
          getTransfers: mockTransactionApi.getTransfers,
        });
      });

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(Object.keys(result)).toContain(differentRecipient);
      expect(result[differentRecipient]?.RECIPIENT_INTERACTION?.[0]?.type).toBe(
        'RECURRING_RECIPIENT',
      );
    });

    it('should handle bridge analysis errors gracefully', async () => {
      const targetChainId = faker.string.numeric(3);
      const mockTxInfo = createMockTxInfo(mockSafeAddress, targetChainId);

      mockChainsRepository.isSupportedChain.mockRejectedValue(
        new Error('Chains service unavailable'),
      );

      const result = await service.analyzeBridge({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        txInfo: mockTxInfo,
      });

      expect(result).toEqual({
        [mockSafeAddress]: {
          BRIDGE: [
            {
              type: 'FAILED',
              severity: 'CRITICAL',
              title: 'Analysis failed',
              description:
                'The analysis failed: bridge compatibility unavailable. Please try again later.',
              targetChainId,
            },
          ],
        },
      });
    });
  });
});
