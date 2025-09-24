import { SafeShieldService } from '../safe-shield.service';
import type { RecipientAnalysisService } from '../recipient-analysis/recipient-analysis.service';
import type { ContractAnalysisService } from '../contract-analysis/contract-analysis.service';
import type { ThreatAnalysisService } from '../threat-analysis/threat-analysis.service';
import type { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import type { DataDecodedService } from '@/routes/data-decode/data-decoded.service';
import type { ILoggingService } from '@/logging/logging.interface';
import type { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import type {
  DecodedTransactionData,
  TransactionData,
} from '@/modules/safe-shield/entities/transaction-data.entity';
import type { RecipientAnalysisResponse } from '../entities/analysis-responses.entity';
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { recipientAnalysisResponseBuilder } from '../entities/__tests__/builders/analysis-responses.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import { recipientAnalysisResultBuilder } from '@/modules/safe-shield/entities/__tests__/builders/analysis-result.builder';

// Utility function for generating Wei values
const generateRandomWeiAmount = (): bigint =>
  faker.number.bigInt({
    min: BigInt('1000000000000000000'),
    max: BigInt('9999999999999999999'),
  });

describe('SafeShieldService', () => {
  const mockRecipientAnalysisService = {
    analyze: jest.fn(),
  } as unknown as jest.Mocked<RecipientAnalysisService>;
  const mockContractAnalysisService =
    {} as unknown as jest.Mocked<ContractAnalysisService>;
  const mockThreatAnalysisService =
    {} as unknown as jest.Mocked<ThreatAnalysisService>;
  const mockMultiSendDecoder = {
    helpers: {
      isMultiSend: jest.fn(),
    },
    mapMultiSendTransactions: jest.fn(),
  } as unknown as jest.Mocked<MultiSendDecoder>;
  const mockDataDecodedService = {
    getDataDecoded: jest.fn(),
  } as unknown as jest.Mocked<DataDecodedService>;

  const mockLoggingService = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as unknown as jest.Mocked<ILoggingService>;

  const service = new SafeShieldService(
    mockRecipientAnalysisService,
    mockContractAnalysisService,
    mockThreatAnalysisService,
    mockMultiSendDecoder,
    mockDataDecodedService,
    mockLoggingService,
  );

  const mockChainId = faker.number.int({ min: 1, max: 999999 }).toString();
  const mockSafeAddress = getAddress(faker.finance.ethereumAddress());
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());
  const mockData = faker.string.hexadecimal({ length: 128 }) as Hex;

  beforeEach(() => {
    jest.resetAllMocks();
  });

  const mockRecipientAnalysisResponse: RecipientAnalysisResponse =
    recipientAnalysisResponseBuilder()
      .with(mockRecipientAddress, {
        RECIPIENT_INTERACTION: [recipientAnalysisResultBuilder().build()],
        BRIDGE: [],
      })
      .build();

  const mockDataDecoded: DataDecoded = dataDecodedBuilder()
    .with('method', 'transfer')
    .with('parameters', [
      {
        name: 'to',
        type: 'address',
        value: mockRecipientAddress,
        valueDecoded: null,
      },
      {
        name: 'value',
        type: 'uint256',
        value: generateRandomWeiAmount().toString(),
        valueDecoded: null,
      },
    ])
    .with('accuracy', 'FULL_MATCH')
    .build();

  describe('analyzeRecipient', () => {
    it('should analyze recipient for a simple transaction', async () => {
      const expectedTransactions: Array<DecodedTransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: BigInt(0),
          data: mockData,
          dataDecoded: mockDataDecoded,
        },
      ];

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        false,
      );
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
        mockDataDecoded,
      );
      (mockRecipientAnalysisService.analyze as jest.Mock).mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        to: mockRecipientAddress,
        data: mockData,
      });

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expectedTransactions,
      });
      expect(mockDataDecodedService.getDataDecoded).toHaveBeenCalledWith({
        chainId: mockChainId,
        getDataDecodedDto: expect.objectContaining({
          data: mockData,
          to: mockRecipientAddress,
        }),
      });
    });

    it('should analyze recipient for a multiSend transaction', async () => {
      const multiSendData: Hex =
        `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex;
      const innerTransactions: Array<TransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: generateRandomWeiAmount(),
          data: faker.string.hexadecimal() as Hex,
        },
        {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: generateRandomWeiAmount(),
          data: '0x',
        },
      ];

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );
      (
        mockMultiSendDecoder.mapMultiSendTransactions as jest.Mock
      ).mockReturnValue(innerTransactions);
      (
        mockDataDecodedService.getDataDecoded as jest.Mock
      ).mockResolvedValueOnce(mockDataDecoded); // Only the first transaction has data to decode
      (mockRecipientAnalysisService.analyze as jest.Mock).mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        to: mockRecipientAddress,
        data: multiSendData,
      });

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockMultiSendDecoder.helpers.isMultiSend).toHaveBeenCalledWith(
        multiSendData,
      );
      expect(
        mockMultiSendDecoder.mapMultiSendTransactions,
      ).toHaveBeenCalledWith(multiSendData);
      expect(mockDataDecodedService.getDataDecoded).toHaveBeenCalledTimes(1);
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expect.arrayContaining([
          expect.objectContaining({
            to: innerTransactions[0].to,
            data: innerTransactions[0].data,
            dataDecoded: mockDataDecoded,
          }),
          expect.objectContaining({
            to: innerTransactions[1].to,
            data: innerTransactions[1].data,
            dataDecoded: null,
          }),
        ]),
      });
    });

    it('should handle multiSend decoding failure gracefully', async () => {
      const multiSendData: Hex =
        `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex;

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );
      (
        mockMultiSendDecoder.mapMultiSendTransactions as jest.Mock
      ).mockImplementation(() => {
        throw new Error('Invalid multiSend data');
      });
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
        null,
      );
      (mockRecipientAnalysisService.analyze as jest.Mock).mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        to: mockRecipientAddress,
        data: multiSendData,
      });

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expect.arrayContaining([
          expect.objectContaining({
            to: mockRecipientAddress,
            data: multiSendData,
            dataDecoded: null,
          }),
        ]),
      });
    });

    it('should handle transaction data with empty data (0x)', async () => {
      const emptyData: Hex = '0x';

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        false,
      );
      (mockRecipientAnalysisService.analyze as jest.Mock).mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        to: mockRecipientAddress,
        data: emptyData,
      });

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockDataDecodedService.getDataDecoded).not.toHaveBeenCalled();
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [
          expect.objectContaining({
            to: mockRecipientAddress,
            data: emptyData,
            dataDecoded: null,
          }),
        ],
      });
    });

    it('should handle data decoding failure gracefully', async () => {
      const error = new Error('Data decoding failed');
      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        false,
      );
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockRejectedValue(
        error,
      );
      (mockRecipientAnalysisService.analyze as jest.Mock).mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        to: mockRecipientAddress,
        data: mockData,
      });

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        `Failed to decode transaction data: ${error}`,
      );
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [
          expect.objectContaining({
            to: mockRecipientAddress,
            data: mockData,
            dataDecoded: null,
          }),
        ],
      });
    });

    it('should handle recipient analysis service failure', async () => {
      const error = new Error('Recipient analysis failed');
      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        false,
      );
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
        mockDataDecoded,
      );
      (mockRecipientAnalysisService.analyze as jest.Mock).mockRejectedValue(
        error,
      );

      await expect(
        service.analyzeRecipient({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          to: mockRecipientAddress,
          data: mockData,
        }),
      ).rejects.toThrow('Recipient analysis failed');
    });

    it('should handle complex multiSend with mixed transaction types', async () => {
      const multiSendData: Hex =
        `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex;
      const innerTransactions: Array<TransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: generateRandomWeiAmount(),
          data: faker.string.hexadecimal() as Hex,
        },
        {
          operation: 1, // Different operation type
          to: getAddress(faker.finance.ethereumAddress()),
          value: BigInt(0),
          data: '0x',
        },
        {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: generateRandomWeiAmount(),
          data: faker.string.hexadecimal() as Hex,
        },
      ];

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );
      (
        mockMultiSendDecoder.mapMultiSendTransactions as jest.Mock
      ).mockReturnValue(innerTransactions);
      (mockDataDecodedService.getDataDecoded as jest.Mock)
        .mockResolvedValueOnce(mockDataDecoded)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockDataDecoded);
      (mockRecipientAnalysisService.analyze as jest.Mock).mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        to: mockRecipientAddress,
        data: multiSendData,
      });

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockDataDecodedService.getDataDecoded).toHaveBeenCalledTimes(2); // Only 2 calls because one has '0x' data
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expect.arrayContaining([
          expect.objectContaining({
            operation: 0,
            to: innerTransactions[0].to,
            value: innerTransactions[0].value,
          }),
          expect.objectContaining({
            operation: 1,
            to: innerTransactions[1].to,
            value: innerTransactions[1].value,
          }),
          expect.objectContaining({
            operation: 0,
            to: innerTransactions[2].to,
            value: innerTransactions[2].value,
          }),
        ]),
      });
    });
  });

  describe('extractTransactions', () => {
    it('should extract single transaction for non-multiSend', async () => {
      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        false,
      );
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
        mockDataDecoded,
      );

      const result = await service['extractTransactions'](
        mockChainId,
        mockRecipientAddress,
        mockData,
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        operation: 0,
        to: mockRecipientAddress,
        value: BigInt(0),
        data: mockData,
        dataDecoded: mockDataDecoded,
      });
    });

    it('should extract multiple transactions for multiSend', async () => {
      const multiSendData: Hex =
        `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex;
      const innerTransactions: Array<TransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: generateRandomWeiAmount(),
          data: mockData,
        },
        {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: BigInt(0),
          data: '0x',
        },
      ];

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );
      (
        mockMultiSendDecoder.mapMultiSendTransactions as jest.Mock
      ).mockReturnValue(innerTransactions);
      (mockDataDecodedService.getDataDecoded as jest.Mock)
        .mockResolvedValueOnce(mockDataDecoded)
        .mockResolvedValueOnce(null);

      const result = await service['extractTransactions'](
        mockChainId,
        mockRecipientAddress,
        multiSendData,
      );

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        operation: 0,
        to: innerTransactions[0].to,
        value: innerTransactions[0].value,
        data: innerTransactions[0].data,
        dataDecoded: mockDataDecoded,
      });
      expect(result[1]).toEqual({
        operation: 0,
        to: innerTransactions[1].to,
        value: innerTransactions[1].value,
        data: innerTransactions[1].data,
        dataDecoded: null,
      });
    });

    it.each([
      ['custom operation with BigInt value', 1, generateRandomWeiAmount()],
      [
        'default operation with string value',
        0,
        generateRandomWeiAmount().toString(),
      ],
      ['delegate call operation with zero value', 1, BigInt(0)],
    ])(
      'should handle %s (operation: %d, value: %s)',
      async (_, operation, value) => {
        (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
          false,
        );
        (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
          mockDataDecoded,
        );

        const result = await service['extractTransactions'](
          mockChainId,
          mockRecipientAddress,
          mockData,
          operation,
          value,
        );

        expect(result[0]).toEqual({
          operation,
          to: mockRecipientAddress,
          value,
          data: mockData,
          dataDecoded: mockDataDecoded,
        });
      },
    );

    it('should handle multiSend extraction failure', async () => {
      const multiSendData: Hex =
        `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex;

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );
      (
        mockMultiSendDecoder.mapMultiSendTransactions as jest.Mock
      ).mockImplementation(() => {
        throw new Error('MultiSend extraction failed');
      });
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
        null,
      );

      const result = await service['extractTransactions'](
        mockChainId,
        mockRecipientAddress,
        multiSendData,
      );

      // Should fall back to treating as single transaction
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        operation: 0,
        to: mockRecipientAddress,
        value: BigInt(0),
        data: multiSendData,
        dataDecoded: null,
      });
    });

    it('should handle large multiSend with many transactions', async () => {
      const multiSendData: Hex =
        `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex;

      // Create 10 inner transactions
      const innerTransactions: Array<TransactionData> = Array.from(
        { length: 10 },
        (_, i) => ({
          operation: i % 2, // Alternate between 0 and 1
          to: getAddress(faker.finance.ethereumAddress()),
          value: BigInt(i * 1000000000000000000),
          data: i % 3 === 0 ? '0x' : (faker.string.hexadecimal() as Hex),
        }),
      );

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );
      (
        mockMultiSendDecoder.mapMultiSendTransactions as jest.Mock
      ).mockReturnValue(innerTransactions);

      // Mock data decoding calls - only for non-empty data
      const nonEmptyDataCount = innerTransactions.filter(
        (tx) => tx.data !== '0x',
      ).length;
      for (let i = 0; i < nonEmptyDataCount; i++) {
        (
          mockDataDecodedService.getDataDecoded as jest.Mock
        ).mockResolvedValueOnce(i % 2 === 0 ? mockDataDecoded : null);
      }

      const result = await service['extractTransactions'](
        mockChainId,
        mockRecipientAddress,
        multiSendData,
      );

      expect(result).toHaveLength(10);
      expect(mockDataDecodedService.getDataDecoded).toHaveBeenCalledTimes(
        nonEmptyDataCount,
      );
    });
  });

  describe('mapDecodedTransactions', () => {
    it('should handle execTransaction by extracting inner transaction', () => {
      const expectedValue = generateRandomWeiAmount().toString();
      const execTransactionDecoded: DataDecoded = dataDecodedBuilder()
        .with('method', 'execTransaction')
        .with('parameters', [
          {
            name: 'to',
            type: 'address',
            value: mockRecipientAddress,
            valueDecoded: null,
          },
          {
            name: 'value',
            type: 'uint256',
            value: expectedValue,
            valueDecoded: null,
          },
          {
            name: 'data',
            type: 'bytes',
            value: mockData,
            valueDecoded: mockDataDecoded,
          },
        ])
        .with('accuracy', 'FULL_MATCH')
        .build();

      const transaction: DecodedTransactionData = {
        operation: 0,
        to: getAddress(faker.finance.ethereumAddress()),
        value: '0',
        data: faker.string.hexadecimal({ length: 32 }) as Hex,
        dataDecoded: execTransactionDecoded,
      };

      const result = service['mapDecodedTransactions'](transaction);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        operation: 0,
        to: mockRecipientAddress,
        value: expectedValue,
        data: mockData,
        dataDecoded: mockDataDecoded,
      });
    });

    it('should handle multiSend by extracting all inner transactions', () => {
      const expectedValue = generateRandomWeiAmount().toString();
      const secondRecipient = getAddress(faker.finance.ethereumAddress());
      const multiSendDecoded: DataDecoded = dataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          {
            name: 'transactions',
            type: 'bytes',
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded: [
              {
                operation: 0,
                to: mockRecipientAddress,
                value: expectedValue,
                data: mockData,
                dataDecoded: mockDataDecoded,
              },
              {
                operation: 0,
                to: secondRecipient,
                value: '0',
                data: '0x',
                dataDecoded: null,
              },
            ],
          },
        ])
        .with('accuracy', 'FULL_MATCH')
        .build();

      const transaction: DecodedTransactionData = {
        operation: 0,
        to: getAddress(faker.finance.ethereumAddress()),
        value: '0',
        data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
        dataDecoded: multiSendDecoded,
      };

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );

      const result = service['mapDecodedTransactions'](transaction);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        operation: 0,
        to: mockRecipientAddress,
        value: expectedValue,
        data: mockData,
        dataDecoded: mockDataDecoded,
      });
      expect(result[1]).toEqual({
        operation: 0,
        to: secondRecipient,
        value: '0',
        data: '0x',
        dataDecoded: null,
      });
    });

    it('should return transaction as-is for non-multiSend, non-execTransaction', () => {
      const transaction: DecodedTransactionData = {
        operation: 0,
        to: mockRecipientAddress,
        value: generateRandomWeiAmount().toString(),
        data: mockData,
        dataDecoded: mockDataDecoded,
      };

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        false,
      );

      const result = service['mapDecodedTransactions'](transaction);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(transaction);
    });

    it('should handle transaction with null dataDecoded', () => {
      const transaction: DecodedTransactionData = {
        operation: 0,
        to: mockRecipientAddress,
        value: generateRandomWeiAmount().toString(),
        data: '0x',
        dataDecoded: null,
      };

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        false,
      );

      const result = service['mapDecodedTransactions'](transaction);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(transaction);
    });

    it('should handle execTransaction with missing parameters', () => {
      const execTransactionDecoded: DataDecoded = dataDecodedBuilder()
        .with('method', 'execTransaction')
        .with('parameters', []) // Missing parameters
        .with('accuracy', 'FULL_MATCH')
        .build();

      const transaction: DecodedTransactionData = {
        operation: 0,
        to: getAddress(faker.finance.ethereumAddress()),
        value: '0',
        data: faker.string.hexadecimal({ length: 32 }) as Hex,
        dataDecoded: execTransactionDecoded,
      };

      // This should throw because it tries to access parameters[0], parameters[1], parameters[2]
      expect(() => service['mapDecodedTransactions'](transaction)).toThrow();
    });

    it.each([
      ['missing valueDecoded', null, 1],
      ['non-array valueDecoded', { method: 'invalid', parameters: null, accuracy: 'UNKNOWN' }, 1],
    ])('should handle multiSend with %s', (_, valueDecoded, expectedLength) => {
      const multiSendDecoded: DataDecoded = dataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          {
            name: 'transactions',
            type: 'bytes',
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded,
          },
        ])
        .with('accuracy', 'FULL_MATCH')
        .build();

      const transaction: DecodedTransactionData = {
        operation: 0,
        to: getAddress(faker.finance.ethereumAddress()),
        value: '0',
        data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
        dataDecoded: multiSendDecoded,
      };

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );

      const result = service['mapDecodedTransactions'](transaction);

      // Should return transaction as-is since valueDecoded is invalid
      expect(result).toHaveLength(expectedLength);
      expect(result[0]).toEqual(transaction);
    });

    it('should handle multiSend with empty array valueDecoded', () => {
      const multiSendDecoded: DataDecoded = dataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          {
            name: 'transactions',
            type: 'bytes',
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded: [], // Empty array - valid but contains no transactions
          },
        ])
        .with('accuracy', 'FULL_MATCH')
        .build();

      const transaction: DecodedTransactionData = {
        operation: 0,
        to: getAddress(faker.finance.ethereumAddress()),
        value: '0',
        data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
        dataDecoded: multiSendDecoded,
      };

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );

      const result = service['mapDecodedTransactions'](transaction);

      // Should return empty array since there are no inner transactions
      expect(result).toHaveLength(0);
    });

    it('should handle nested execTransaction within multiSend', () => {
      const nestedExecTransaction = {
        operation: 0,
        to: mockRecipientAddress,
        value: generateRandomWeiAmount().toString(),
        data: '0x' as Hex,
        dataDecoded: {
          method: 'execTransaction',
          parameters: [
            {
              name: 'to',
              type: 'address',
              value: getAddress(faker.finance.ethereumAddress()),
              valueDecoded: null,
            },
            {
              name: 'value',
              type: 'uint256',
              value: generateRandomWeiAmount().toString(),
              valueDecoded: null,
            },
            {
              name: 'data',
              type: 'bytes',
              value: '0x',
              valueDecoded: null,
            },
          ],
          accuracy: 'FULL_MATCH',
        },
      };

      const multiSendDecoded: DataDecoded = dataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          {
            name: 'transactions',
            type: 'bytes',
            value: faker.string.hexadecimal({ length: 32 }),
            valueDecoded: [nestedExecTransaction],
          },
        ])
        .with('accuracy', 'FULL_MATCH')
        .build();

      const transaction: DecodedTransactionData = {
        operation: 0,
        to: getAddress(faker.finance.ethereumAddress()),
        value: '0',
        data: `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex,
        dataDecoded: multiSendDecoded,
      };

      (mockMultiSendDecoder.helpers.isMultiSend as jest.Mock).mockReturnValue(
        true,
      );

      const result = service['mapDecodedTransactions'](transaction);

      // Should extract the inner execTransaction
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        operation: 0,
        to: nestedExecTransaction.dataDecoded.parameters[0].value,
        value: nestedExecTransaction.dataDecoded.parameters[1].value,
        data: '0x',
        dataDecoded: null,
      });
    });
  });

  describe('decodeTransactionData', () => {
    it('should successfully decode transaction data', async () => {
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
        mockDataDecoded,
      );

      const result = await service['decodeTransactionData'](
        mockChainId,
        mockRecipientAddress,
        mockData,
      );

      expect(result).toEqual(mockDataDecoded);
      expect(mockDataDecodedService.getDataDecoded).toHaveBeenCalledWith({
        chainId: mockChainId,
        getDataDecodedDto: expect.objectContaining({
          data: mockData,
          to: mockRecipientAddress,
        }),
      });
    });

    it('should handle decoding failure gracefully', async () => {
      const error = new Error('Decoding failed');
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockRejectedValue(
        error,
      );

      const result = await service['decodeTransactionData'](
        mockChainId,
        mockRecipientAddress,
        mockData,
      );

      expect(result).toBeNull();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        `Failed to decode transaction data: ${error}`,
      );
    });

    it('should create TransactionDataDto with correct parameters', async () => {
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
        mockDataDecoded,
      );

      await service['decodeTransactionData'](
        mockChainId,
        mockRecipientAddress,
        mockData,
      );

      expect(mockDataDecodedService.getDataDecoded).toHaveBeenCalledWith({
        chainId: mockChainId,
        getDataDecodedDto: expect.objectContaining({
          data: mockData,
          to: mockRecipientAddress,
        }),
      });
    });

    it.each([
      ['Error object', new Error('Network timeout')],
      ['TypeError object', new TypeError('Invalid address format')],
      ['RangeError object', new RangeError('Invalid data length')],
      ['Custom error object', { message: 'Custom error object' }],
      ['String error', 'String error'],
      ['null error', null],
      ['undefined error', undefined],
    ])('should handle %s gracefully', async (_, error) => {
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockRejectedValue(
        error,
      );

      const result = await service['decodeTransactionData'](
        mockChainId,
        mockRecipientAddress,
        mockData,
      );

      expect(result).toBeNull();
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        `Failed to decode transaction data: ${error}`,
      );
    });

    it.each([
      ['Ethereum mainnet', '1'],
      ['Polygon mainnet', '137'],
      ['Arbitrum One', '42161'],
    ])(
      'should handle %s (chainId: %s) and different addresses',
      async (_, chainId) => {
        const address = getAddress(faker.finance.ethereumAddress());
        (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
          mockDataDecoded,
        );

        const result = await service['decodeTransactionData'](
          chainId,
          address,
          mockData,
        );

        expect(result).toEqual(mockDataDecoded);
        expect(mockDataDecodedService.getDataDecoded).toHaveBeenCalledWith({
          chainId,
          getDataDecodedDto: expect.objectContaining({
            data: mockData,
            to: address,
          }),
        });
      },
    );

    it.each([
      ['empty data', '0x' as Hex],
      ['single byte', '0x00' as Hex],
      ['ERC-20 transfer', '0xa9059cbb' as Hex],
      ['ERC-20 transferFrom', '0x23b872dd' as Hex],
      ['ERC-20 approve', '0x095ea7b3' as Hex],
      ['short hex data', faker.string.hexadecimal({ length: 8 }) as Hex],
      ['long hex data', faker.string.hexadecimal({ length: 256 }) as Hex],
    ])('should handle %s (%s)', async (_, data) => {
      (mockDataDecodedService.getDataDecoded as jest.Mock).mockResolvedValue(
        mockDataDecoded,
      );

      const result = await service['decodeTransactionData'](
        mockChainId,
        mockRecipientAddress,
        data,
      );

      expect(result).toEqual(mockDataDecoded);
      expect(mockDataDecodedService.getDataDecoded).toHaveBeenCalledWith({
        chainId: mockChainId,
        getDataDecodedDto: expect.objectContaining({
          data,
          to: mockRecipientAddress,
        }),
      });
    });
  });
});
