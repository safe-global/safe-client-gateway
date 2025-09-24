import { Test, TestingModule } from '@nestjs/testing';
import { RecipientAnalysisService } from '../recipient-analysis.service';
import { ITransactionApiManager } from '@/domain/interfaces/transaction-api.manager.interface';
import { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import type { ITransactionApi } from '@/domain/interfaces/transaction-api.interface';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { Page } from '@/domain/entities/page.entity';
import type { Transfer } from '@/domain/safe/entities/transfer.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('RecipientAnalysisService', () => {
  let service: RecipientAnalysisService;
  let mockTransactionApiManager: jest.Mocked<ITransactionApiManager>;
  let mockTransactionApi: jest.Mocked<ITransactionApi>;
  let mockErc20Decoder: jest.Mocked<Erc20Decoder>;

  const mockChainId = '1';
  const mockSafeAddress = getAddress(faker.finance.ethereumAddress());
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());

  beforeEach(async () => {
    // Create properly typed mocks
    mockTransactionApi = { getTransfers: jest.fn() } as any;

    mockTransactionApiManager = {
      getApi: jest.fn().mockResolvedValue(mockTransactionApi),
    } as any;

    mockErc20Decoder = {
      helpers: {
        isTransfer: jest.fn(),
        isTransferFrom: jest.fn(),
      },
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecipientAnalysisService,
        {
          provide: ITransactionApiManager,
          useValue: mockTransactionApiManager,
        },
        {
          provide: Erc20Decoder,
          useValue: mockErc20Decoder,
        },
      ],
    }).compile();

    service = module.get<RecipientAnalysisService>(RecipientAnalysisService);
  });

  afterEach(() => {
    jest.clearAllMocks();
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

      const transactions: DecodedTransactionData[] = [
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

      (mockTransactionApi.getTransfers as jest.Mock)
        .mockResolvedValueOnce(mockTransferPage(5))
        .mockResolvedValueOnce(mockTransferPage(0));

      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions,
      });

      expect(result).toEqual({
        [recipient1]: {
          RECIPIENT_INTERACTION: [
            {
              severity: 'OK',
              type: 'KNOWN_RECIPIENT',
              title: 'Recurring recipient',
              description: 'You have interacted with this address 5 times.',
            },
          ],
          BRIDGE: [],
        },
        [recipient2]: {
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
        },
      });

      expect(mockTransactionApi.getTransfers).toHaveBeenCalledTimes(2);
    });

    it('should handle empty transactions array', async () => {
      const result = await service.analyze({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [],
      });

      expect(result).toEqual({});
      expect(mockTransactionApi.getTransfers).not.toHaveBeenCalled();
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
  });

  describe('extractRecipients', () => {
    it('should extract unique recipients from transactions', () => {
      const recipient1 = getAddress(faker.finance.ethereumAddress());
      const recipient2 = getAddress(faker.finance.ethereumAddress());

      const transactions: DecodedTransactionData[] = [
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

      const transactions: DecodedTransactionData[] = [
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
          } as any,
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
              { value: expectedRecipient },
              { value: '1000000000000000000' },
              { value: '0x' },
            ],
          } as any,
        };

        const result = service['extractRecipient'](transaction);

        expect(result).toBe(expectedRecipient);
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
              { value: expectedRecipient },
              { value: '1000000000000000000' },
            ],
          } as any,
        };

        (mockErc20Decoder.helpers.isTransfer as jest.Mock).mockReturnValue(
          true,
        );

        const result = service['extractRecipient'](transaction);

        expect(result).toBe(expectedRecipient);
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
              { value: sender },
              { value: expectedRecipient },
              { value: '1000000000000000000' },
            ],
          } as any,
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
          } as any,
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
  });
});
