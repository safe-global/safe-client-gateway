import { RecipientAnalysisService } from '../recipient-analysis.service';
import type { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Transfer } from '@/domain/safe/entities/transfer.entity';
import type { IConfigurationService } from '@/config/configuration.service.interface';
import type { ICacheService } from '@/datasources/cache/cache.service.interface';
import type { ILoggingService } from '@/logging/logging.interface';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('RecipientAnalysisService', () => {
  const mockTransactionApi = {
    getTransfers: jest.fn(),
  } as unknown as jest.Mocked<ITransactionApi>;

  const mockTransactionApiManager = {
    getApi: jest.fn().mockResolvedValue(mockTransactionApi),
  } as unknown as jest.Mocked<ITransactionApiManager>;

  const mockErc20Decoder = {
    helpers: {
      isTransfer: jest.fn(),
      isTransferFrom: jest.fn(),
    },
  } as unknown as jest.Mocked<Erc20Decoder>;

  const mockConfigurationService = {
    getOrThrow: jest.fn().mockReturnValue(3600), // Default cache expiration
  } as unknown as jest.Mocked<IConfigurationService>;

  const mockCacheService = {
    hGet: jest.fn(),
    hSet: jest.fn(),
  } as unknown as jest.Mocked<ICacheService>;

  const mockLoggingService = {
    debug: jest.fn(),
  } as unknown as jest.Mocked<ILoggingService>;

  const service = new RecipientAnalysisService(
    mockTransactionApiManager,
    mockErc20Decoder,
    mockConfigurationService,
    mockCacheService,
    mockLoggingService,
  );

  const mockChainId = '1';
  const mockSafeAddress = getAddress(faker.finance.ethereumAddress());
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    jest.resetAllMocks();
    // Re-establish the mock chain
    (mockTransactionApiManager.getApi as jest.Mock).mockResolvedValue(
      mockTransactionApi,
    );
  });

  const mockTransferPage = (count: number | null): Page<Transfer> => ({
    count,
    next: null,
    previous: null,
    results: [],
  });

  describe('analyze', () => {
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

      // Mock cache miss
      (mockCacheService.hGet as jest.Mock).mockResolvedValue(null);
      (mockTransactionApi.getTransfers as jest.Mock)
        .mockResolvedValueOnce(mockTransferPage(5))
        .mockResolvedValueOnce(mockTransferPage(0));

      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions,
      });

      // Check that both recipients are analyzed
      expect(Object.keys(result)).toHaveLength(2);
      expect(Object.keys(result)).toContain(recipient1);
      expect(Object.keys(result)).toContain(recipient2);

      // Check that one recipient is KNOWN_RECIPIENT (5 interactions) and the other is NEW_RECIPIENT (0 interactions)
      const results = Object.values(result);
      const knownRecipientResult = results.find(
        (r) => r?.RECIPIENT_INTERACTION?.[0]?.type === 'KNOWN_RECIPIENT',
      );
      const newRecipientResult = results.find(
        (r) => r?.RECIPIENT_INTERACTION?.[0]?.type === 'NEW_RECIPIENT',
      );

      expect(knownRecipientResult).toEqual({
        RECIPIENT_INTERACTION: [
          {
            severity: 'OK',
            type: 'KNOWN_RECIPIENT',
            title: 'Recurring recipient',
            description: 'You have interacted with this address 5 times.',
          },
        ],
        BRIDGE: [],
      });

      expect(newRecipientResult).toEqual({
        RECIPIENT_INTERACTION: [
          {
            severity: 'INFO',
            type: 'NEW_RECIPIENT',
            title: 'New Recipient',
            description:
              'You are interacting with this address for the first time.',
          },
        ],
        BRIDGE: [],
      });

      expect(mockTransactionApi.getTransfers).toHaveBeenCalledTimes(2);
    });

    it('should handle empty transactions array', async () => {
      (mockCacheService.hGet as jest.Mock).mockResolvedValue(null);

      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [],
      });

      expect(result).toEqual({});
      expect(mockTransactionApi.getTransfers).not.toHaveBeenCalled();
      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.any(String),
          field: expect.any(String),
        }),
        '{}',
        3600,
      );
    });

    it('should return cached result when available', async () => {
      const cachedResult = {
        [mockRecipientAddress]: {
          RECIPIENT_INTERACTION: [
            {
              severity: 'OK',
              type: 'KNOWN_RECIPIENT',
              title: 'Recurring recipient',
              description: 'You have interacted with this address 3 times.',
            },
          ],
          BRIDGE: [],
        },
      };

      (mockCacheService.hGet as jest.Mock).mockResolvedValue(
        JSON.stringify(cachedResult),
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
      });

      expect(result).toEqual(cachedResult);
      expect(mockTransactionApi.getTransfers).not.toHaveBeenCalled();
      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'CACHE_HIT',
        key: expect.any(String),
        field: expect.any(String),
      });
    });

    it('should cache result when not in cache', async () => {
      (mockCacheService.hGet as jest.Mock).mockResolvedValue(null);
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(2),
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
      });

      expect(mockLoggingService.debug).toHaveBeenCalledWith({
        type: 'CACHE_MISS',
        key: expect.any(String),
        field: expect.any(String),
      });

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.any(String),
          field: expect.any(String),
        }),
        JSON.stringify(result),
        3600,
      );
    });
  });

  describe('analyzeRecipient', () => {
    it('should return analysis result for a recipient', async () => {
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(3),
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        RECIPIENT_INTERACTION: [
          {
            severity: 'OK',
            type: 'KNOWN_RECIPIENT',
            title: 'Recurring recipient',
            description: 'You have interacted with this address 3 times.',
          },
        ],
        BRIDGE: [],
      });
    });
  });

  describe('analyzeInteractions', () => {
    it('should return KNOWN_RECIPIENT when interactions > 0', async () => {
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(5),
      );

      const result = await service.analyzeInteractions({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        severity: 'OK',
        type: 'KNOWN_RECIPIENT',
        title: 'Recurring recipient',
        description: 'You have interacted with this address 5 times.',
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
        title: 'New Recipient',
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
        title: 'New Recipient',
        description:
          'You are interacting with this address for the first time.',
      });
    });

    it('should handle API errors gracefully', async () => {
      const error = new Error('API connection failed');
      (mockTransactionApi.getTransfers as jest.Mock).mockRejectedValue(error);

      await expect(
        service.analyzeInteractions({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          recipient: mockRecipientAddress,
        }),
      ).rejects.toThrow('API connection failed');

      expect(mockTransactionApiManager.getApi).toHaveBeenCalledWith(
        mockChainId,
      );
    });

    it('should handle invalid transfer page response', async () => {
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue({
        invalidField: 'invalid',
      });

      await expect(
        service.analyzeInteractions({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          recipient: mockRecipientAddress,
        }),
      ).rejects.toThrow();
    });

    it('should handle large interaction counts correctly', async () => {
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(999),
      );

      const result = await service.analyzeInteractions({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });

      expect(result).toEqual({
        severity: 'OK',
        type: 'KNOWN_RECIPIENT',
        title: 'Recurring recipient',
        description: 'You have interacted with this address 999 times.',
      });
    });
  });

  describe('extractRecipients', () => {
    it('should extract unique recipients from transactions', () => {
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
          to: recipient1, // Duplicate
          value: '500000000000000000',
          data: '0x',
          dataDecoded: null,
        },
      ];

      const result = service['extractRecipients'](transactions);

      expect(result).toHaveLength(2);
      expect(result).toContain(recipient1);
      expect(result).toContain(recipient2);
    });

    it('should filter out undefined recipients', () => {
      const validRecipient = getAddress(faker.finance.ethereumAddress());

      const transactions: Array<DecodedTransactionData> = [
        {
          operation: 0,
          to: validRecipient,
          value: '1000000000000000000',
          data: '0x',
          dataDecoded: null,
        },
        {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: '2000000000000000000',
          data: '0xunknownmethod', // Unknown method that doesn't match any pattern
          dataDecoded: {
            method: 'unknownMethod',
            parameters: [],
            accuracy: 'UNKNOWN',
          },
        },
      ];

      (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(false);
      (mockErc20Decoder.helpers.isTransferFrom as jest.Mock).mockReturnValue(
        false,
      );

      const result = service['extractRecipients'](transactions);

      expect(result).toEqual([validRecipient]);
    });
  });

  describe('extractRecipient', () => {
    describe('execTransaction with empty data', () => {
      it('should extract recipient from execTransaction parameters', () => {
        const expectedRecipient = getAddress(faker.finance.ethereumAddress());

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: '1000000000000000000',
          data: '0x',
          dataDecoded: {
            method: 'execTransaction',
            parameters: [
              { name: 'to', type: 'address', value: expectedRecipient },
              { name: 'value', type: 'uint256', value: '1000000000000000000' },
              { name: 'data', type: 'bytes', value: '0x' },
            ],
            accuracy: 'FULL_MATCH',
          },
        };

        const result = service['extractRecipient'](transaction);

        expect(result).toBe(expectedRecipient);
      });

      it('should not extract from execTransaction with non-empty data', () => {
        // Setup mock to return false for ERC-20 checks since data isn't recognized
        (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(
          false,
        );
        (mockErc20Decoder.helpers.isTransferFrom as jest.Mock).mockReturnValue(
          false,
        );

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: '1000000000000000000',
          data: '0xa9059cbb', // Non-empty data - not a native transfer, doesn't match ERC-20
          dataDecoded: {
            method: 'execTransaction',
            parameters: [
              {
                name: 'to',
                type: 'address',
                value: getAddress(faker.finance.ethereumAddress()),
              },
              { name: 'value', type: 'uint256', value: '1000000000000000000' },
              { name: 'data', type: 'bytes', value: '0xa9059cbb' }, // Non-empty data
            ],
            accuracy: 'FULL_MATCH',
          },
        };

        const result = service['extractRecipient'](transaction);

        // Since data is not '0x' and doesn't match ERC-20 patterns, returns undefined
        expect(result).toBeUndefined();
      });

      it('should handle execTransaction with missing parameters and throw error', () => {
        const transaction: DecodedTransactionData = {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: '1000000000000000000',
          data: '0x',
          dataDecoded: {
            method: 'execTransaction',
            parameters: [], // Missing parameters - this will cause error when trying to access parameters[2]
            accuracy: 'FULL_MATCH',
          },
        };

        // This should throw because the service tries to access parameters[2].value on empty array
        expect(() => service['extractRecipient'](transaction)).toThrow();
      });
    });

    describe('ERC-20 transfer', () => {
      it('should extract recipient from transfer function', () => {
        const expectedRecipient = getAddress(faker.finance.ethereumAddress());

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: '0',
          data: '0xa9059cbb',
          dataDecoded: {
            method: 'transfer',
            parameters: [
              { name: 'to', type: 'address', value: expectedRecipient },
              { name: 'value', type: 'uint256', value: '1000000000000000000' },
            ],
            accuracy: 'FULL_MATCH',
          },
        };

        (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(
          true,
        );

        const result = service['extractRecipient'](transaction);

        expect(result).toBe(expectedRecipient);
      });

      it('should handle transfer with missing parameters and throw error', () => {
        // Setup mocks
        (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(
          true,
        );
        (mockErc20Decoder.helpers.isTransferFrom as jest.Mock).mockReturnValue(
          false,
        );

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: '0',
          data: '0xa9059cbb',
          dataDecoded: {
            method: 'transfer',
            parameters: [], // Missing parameters - will cause error accessing parameters[0]
            accuracy: 'FULL_MATCH',
          },
        };

        // This should fail because the service tries to access parameters[0].value on empty array
        expect(() => service['extractRecipient'](transaction)).toThrow();
      });
    });

    describe('ERC-20 transferFrom', () => {
      it('should extract recipient from transferFrom function', () => {
        const sender = getAddress(faker.finance.ethereumAddress());
        const expectedRecipient = getAddress(faker.finance.ethereumAddress());

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: '0',
          data: '0x23b872dd',
          dataDecoded: {
            method: 'transferFrom',
            parameters: [
              { name: 'from', type: 'address', value: sender },
              { name: 'to', type: 'address', value: expectedRecipient },
              { name: 'value', type: 'uint256', value: '1000000000000000000' },
            ],
            accuracy: 'FULL_MATCH',
          },
        };

        (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(
          false,
        );
        (mockErc20Decoder.helpers.isTransferFrom as jest.Mock).mockReturnValue(
          true,
        );

        const result = service['extractRecipient'](transaction);

        expect(result).toBe(expectedRecipient);
      });
    });

    describe('Native transfer', () => {
      it('should extract recipient from transaction.to for native transfer with empty data', () => {
        const expectedRecipient = getAddress(faker.finance.ethereumAddress());

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: expectedRecipient,
          value: '1000000000000000000',
          data: '0x',
          dataDecoded: null,
        };

        (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(
          false,
        );
        (mockErc20Decoder.helpers.isTransferFrom as jest.Mock).mockReturnValue(
          false,
        );

        const result = service['extractRecipient'](transaction);

        expect(result).toBe(expectedRecipient);
      });

      it('should extract recipient from transaction.to when dataDecoded is null', () => {
        const expectedRecipient = getAddress(faker.finance.ethereumAddress());

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: expectedRecipient,
          value: '1000000000000000000',
          data: '0xsomedata',
          dataDecoded: null,
        };

        (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(
          false,
        );
        (mockErc20Decoder.helpers.isTransferFrom as jest.Mock).mockReturnValue(
          false,
        );

        const result = service['extractRecipient'](transaction);

        expect(result).toBe(expectedRecipient);
      });
    });

    describe('unrecognized transactions', () => {
      it('should return undefined for unrecognized contract interactions', () => {
        const transaction: DecodedTransactionData = {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: '0',
          data: '0xunknownmethod',
          dataDecoded: {
            method: 'unknownMethod',
            parameters: [],
            accuracy: 'UNKNOWN',
          },
        };

        (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(
          false,
        );
        (mockErc20Decoder.helpers.isTransferFrom as jest.Mock).mockReturnValue(
          false,
        );

        const result = service['extractRecipient'](transaction);

        expect(result).toBeUndefined();
      });
    });
  });

  describe('mapToAnalysisResult', () => {
    it('should map recipient status with interactions', () => {
      const result = service['mapToAnalysisResult']('KNOWN_RECIPIENT', 5);

      expect(result).toEqual({
        severity: 'OK',
        type: 'KNOWN_RECIPIENT',
        title: 'Recurring recipient',
        description: 'You have interacted with this address 5 times.',
      });
    });

    it('should map new recipient status', () => {
      const result = service['mapToAnalysisResult']('NEW_RECIPIENT', 0);

      expect(result).toEqual({
        severity: 'INFO',
        type: 'NEW_RECIPIENT',
        title: 'New Recipient',
        description:
          'You are interacting with this address for the first time.',
      });
    });

    it('should handle single interaction correctly', () => {
      const result = service['mapToAnalysisResult']('KNOWN_RECIPIENT', 1);

      expect(result).toEqual({
        severity: 'OK',
        type: 'KNOWN_RECIPIENT',
        title: 'Recurring recipient',
        description: 'You have interacted with this address 1 time.',
      });
    });

    it('should handle very large interaction counts', () => {
      const result = service['mapToAnalysisResult']('KNOWN_RECIPIENT', 10000);

      expect(result).toEqual({
        severity: 'OK',
        type: 'KNOWN_RECIPIENT',
        title: 'Recurring recipient',
        description: 'You have interacted with this address 10000 times.',
      });
    });
  });
});
