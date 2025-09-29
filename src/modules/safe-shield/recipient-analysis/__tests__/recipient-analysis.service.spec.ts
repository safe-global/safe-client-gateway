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
import { pageBuilder } from '@/domain/entities/__tests__/page.builder';
import * as utils from '../../utils/recipient-extraction.utils';

describe('RecipientAnalysisService', () => {
  const mockTransactionApi = {
    getTransfers: jest.fn(),
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

  const mockCacheService = {
    hGet: jest.fn(),
    hSet: jest.fn(),
  } as jest.MockedObjectDeep<ICacheService>;

  const mockLoggingService = {
    debug: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>;

  const service = new RecipientAnalysisService(
    mockTransactionApiManager,
    mockErc20Decoder,
    mockConfigurationService,
    mockCacheService,
    mockLoggingService,
  );

  const extractRecipientsSpy = jest.spyOn(utils, 'extractRecipients');

  const mockChainId = '1';
  const mockSafeAddress = getAddress(faker.finance.ethereumAddress());
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(() => {
    jest.resetAllMocks();
    // Re-establish the mock chain
    mockTransactionApiManager.getApi.mockResolvedValue(mockTransactionApi);
    extractRecipientsSpy.mockImplementation(
      (transactions: Array<DecodedTransactionData>) =>
        transactions.map((tx: DecodedTransactionData) => tx.to),
    );
  });

  const mockTransferPage = (count: number | null): Page<Transfer> =>
    pageBuilder<Transfer>().with('count', count).build();

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
      extractRecipientsSpy.mockReturnValue([recipient1, recipient2]);
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
            title: 'New recipient',
            description:
              'You are interacting with this address for the first time.',
          },
        ],
        BRIDGE: [],
      });

      expect(mockTransactionApi.getTransfers).toHaveBeenCalledTimes(2);

      expect(extractRecipientsSpy).toHaveBeenCalledTimes(1);
      expect(extractRecipientsSpy).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
      );
    });

    it('should handle empty transactions array', async () => {
      (mockCacheService.hGet as jest.Mock).mockResolvedValue(null);
      extractRecipientsSpy.mockReturnValue([]);

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

      expect(extractRecipientsSpy).toHaveBeenCalledTimes(1);
      expect(extractRecipientsSpy).toHaveBeenCalledWith([], mockErc20Decoder);
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

      mockCacheService.hGet.mockResolvedValue(JSON.stringify(cachedResult));
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

      expect(result).toEqual(cachedResult);
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
      (mockCacheService.hGet as jest.Mock).mockResolvedValue(null);
      (mockTransactionApi.getTransfers as jest.Mock).mockResolvedValue(
        mockTransferPage(2),
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

      expect(mockCacheService.hSet).toHaveBeenCalledWith(
        expect.objectContaining({
          key: expect.any(String),
          field: expect.any(String),
        }),
        JSON.stringify(result),
        3600,
      );

      expect(extractRecipientsSpy).toHaveBeenCalledTimes(1);
      expect(extractRecipientsSpy).toHaveBeenCalledWith(
        transactions,
        mockErc20Decoder,
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
});
