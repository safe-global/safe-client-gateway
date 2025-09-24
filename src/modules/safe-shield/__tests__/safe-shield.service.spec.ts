import { SafeShieldService } from '../safe-shield.service';
import type { RecipientAnalysisService } from '../recipient-analysis/recipient-analysis.service';
import type { ContractAnalysisService } from '../contract-analysis/contract-analysis.service';
import type { ThreatAnalysisService } from '../threat-analysis/threat-analysis.service';
import type { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import type { DataDecodedService } from '@/routes/data-decode/data-decoded.service';
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

  const service = new SafeShieldService(
    mockRecipientAnalysisService,
    mockContractAnalysisService,
    mockThreatAnalysisService,
    mockMultiSendDecoder,
    mockDataDecodedService,
  );

  const mockChainId = '1';
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
        value: '1000000000000000000',
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
        '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000';
      const innerTransactions: Array<TransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: BigInt(1000000000000000000),
          data: faker.string.hexadecimal() as Hex,
        },
        {
          operation: 0,
          to: getAddress(faker.finance.ethereumAddress()),
          value: BigInt(2000000000000000000),
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
        '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000';

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
        '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000';
      const innerTransactions: Array<TransactionData> = [
        {
          operation: 0,
          to: mockRecipientAddress,
          value: BigInt(1000000000000000000),
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

    it('should handle custom operation and value parameters', async () => {
      const customOperation = 1;
      const customValue = BigInt(5000000000000000000);

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
        customOperation,
        customValue,
      );

      expect(result[0]).toEqual({
        operation: customOperation,
        to: mockRecipientAddress,
        value: customValue,
        data: mockData,
        dataDecoded: mockDataDecoded,
      });
    });
  });

  describe('mapDecodedTransactions', () => {
    it('should handle execTransaction by extracting inner transaction', () => {
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
            value: '1000000000000000000',
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
        data: '0xexecTransactionData',
        dataDecoded: execTransactionDecoded,
      };

      const result = service['mapDecodedTransactions'](transaction);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        operation: 0,
        to: mockRecipientAddress,
        value: '1000000000000000000',
        data: mockData,
        dataDecoded: mockDataDecoded,
      });
    });

    it('should handle multiSend by extracting all inner transactions', () => {
      const multiSendDecoded: DataDecoded = dataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          {
            name: 'transactions',
            type: 'bytes',
            value: '0x...',
            valueDecoded: [
              {
                operation: 0,
                to: mockRecipientAddress,
                value: '1000000000000000000',
                data: mockData,
                dataDecoded: mockDataDecoded,
              },
              {
                operation: 0,
                to: getAddress(faker.finance.ethereumAddress()),
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
        data: '0x8d80ff0a000000000000000000000000000000000000000000000000000000000000002000000000',
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
        value: '1000000000000000000',
        data: mockData,
        dataDecoded: mockDataDecoded,
      });
      expect(result[1]).toEqual({
        operation: 0,
        to: expect.any(String),
        value: '0',
        data: '0x',
        dataDecoded: null,
      });
    });

    it('should return transaction as-is for non-multiSend, non-execTransaction', () => {
      const transaction: DecodedTransactionData = {
        operation: 0,
        to: mockRecipientAddress,
        value: '1000000000000000000',
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
        value: '1000000000000000000',
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

      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const result = await service['decodeTransactionData'](
        mockChainId,
        mockRecipientAddress,
        mockData,
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to decode transaction data:',
        error,
      );

      consoleSpy.mockRestore();
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
  });
});
