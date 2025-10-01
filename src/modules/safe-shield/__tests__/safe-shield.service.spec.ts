import { SafeShieldService } from '../safe-shield.service';
import type { RecipientAnalysisService } from '../recipient-analysis/recipient-analysis.service';
import type { ContractAnalysisService } from '../contract-analysis/contract-analysis.service';
import type { ThreatAnalysisService } from '../threat-analysis/threat-analysis.service';
import type { ILoggingService } from '@/logging/logging.interface';
import type { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { RecipientAnalysisResponse } from '../entities/analysis-responses.entity';
import type { TransactionsService } from '@/routes/transactions/transactions.service';
import type { TransactionPreview } from '@/routes/transactions/entities/transaction-preview.entity';
import {
  TransferTransactionInfo,
  TransferDirection,
} from '@/routes/transactions/entities/transfer-transaction-info.entity';
import { CustomTransactionInfo } from '@/routes/transactions/entities/custom-transaction.entity';
import { NativeCoinTransfer } from '@/routes/transactions/entities/transfers/native-coin-transfer.entity';
import { TransactionData } from '@/routes/transactions/entities/transaction-data.entity';
import { AddressInfo } from '@/routes/common/entities/address-info.entity';
import { faker } from '@faker-js/faker';
import { getAddress, type Hex } from 'viem';
import { recipientAnalysisResponseBuilder } from '../entities/__tests__/builders/analysis-responses.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import { recipientAnalysisResultBuilder } from '@/modules/safe-shield/entities/__tests__/builders/analysis-result.builder';
import { Operation } from '@/domain/safe/entities/operation.entity';
import * as utils from '../utils/transaction-mapping.utils';

// Utility function for generating Wei values
const generateRandomWeiAmount = (): bigint =>
  faker.number.bigInt({
    min: BigInt('1000000000000000000'),
    max: BigInt('9999999999999999999'),
  });

// Helper function to create TransactionPreview mocks
const createTransactionPreviewMock = ({
  txInfo,
  hexData,
  dataDecoded,
  to,
  value = '0',
  operation = Operation.CALL,
}: {
  txInfo: TransferTransactionInfo | CustomTransactionInfo;
  hexData: Hex;
  dataDecoded: DataDecoded | null;
  to: string;
  value?: string;
  operation?: Operation;
}): TransactionPreview => ({
  txInfo,
  txData: new TransactionData(
    hexData,
    dataDecoded,
    new AddressInfo(to),
    value,
    operation,
    null,
    null,
    null,
  ),
});

// Helper function to create TransferTransactionInfo
const createTransferTransactionInfo = (
  sender: string,
  recipient: string,
  value: string = '0',
): TransferTransactionInfo =>
  new TransferTransactionInfo(
    new AddressInfo(sender),
    new AddressInfo(recipient),
    TransferDirection.Outgoing,
    new NativeCoinTransfer(value),
    null,
  );

// Helper function to create CustomTransactionInfo
const createCustomTransactionInfo = (
  to: string,
  dataSize: string,
  value: string = '0',
  methodName: string = 'customMethod',
  description: string = 'Custom transaction',
): CustomTransactionInfo =>
  new CustomTransactionInfo(
    new AddressInfo(to),
    dataSize,
    value,
    methodName,
    null,
    false,
    description,
  );

describe('SafeShieldService', () => {
  const mapDecodedTransactionsSpy = jest.spyOn(utils, 'mapDecodedTransactions');

  const mockRecipientAnalysisService = {
    analyze: jest.fn(),
  } as jest.MockedObjectDeep<RecipientAnalysisService>;
  const mockContractAnalysisService =
    {} as jest.MockedObjectDeep<ContractAnalysisService>;
  const mockThreatAnalysisService =
    {} as jest.MockedObjectDeep<ThreatAnalysisService>;
  const mockTransactionsService = {
    previewTransaction: jest.fn(),
  } as jest.MockedObjectDeep<TransactionsService>;

  const mockLoggingService = {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  } as jest.MockedObjectDeep<ILoggingService>;

  const service = new SafeShieldService(
    mockRecipientAnalysisService,
    mockContractAnalysisService,
    mockThreatAnalysisService,
    mockLoggingService,
    mockTransactionsService,
  );

  const mockChainId = faker.number.int({ min: 1, max: 999999 }).toString();
  const mockSafeAddress = getAddress(faker.finance.ethereumAddress());
  const mockRecipientAddress = getAddress(faker.finance.ethereumAddress());
  const mockData = faker.string.hexadecimal({ length: 128 }) as Hex;

  beforeEach(() => {
    jest.resetAllMocks();
    mapDecodedTransactionsSpy.mockImplementation((tx) => [tx]);
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
      const mockTransactionPreview = createTransactionPreviewMock({
        txInfo: createTransferTransactionInfo(
          mockSafeAddress,
          mockRecipientAddress,
        ),
        hexData: mockData,
        dataDecoded: mockDataDecoded,
        to: mockRecipientAddress,
      });

      const expectedTransactions: Array<DecodedTransactionData> = [
        {
          operation: Operation.CALL,
          to: mockRecipientAddress,
          value: '0',
          data: mockData,
          dataDecoded: mockDataDecoded,
        },
      ];

      mockTransactionsService.previewTransaction.mockResolvedValue(
        mockTransactionPreview,
      );
      mockRecipientAnalysisService.analyze.mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        tx: {
          to: mockRecipientAddress,
          data: mockData,
        },
      });

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockTransactionsService.previewTransaction).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        previewTransactionDto: {
          to: mockRecipientAddress,
          data: mockData,
          operation: Operation.CALL,
          value: '0',
        },
      });
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expectedTransactions,
      });
    });

    it('should analyze recipient for a multiSend transaction', async () => {
      const multiSendData: Hex =
        `0x8d80ff0a${faker.string.hexadecimal({ length: 128, casing: 'lower', prefix: '' })}` as Hex;

      const multiSendDataDecoded: DataDecoded = dataDecodedBuilder()
        .with('method', 'multiSend')
        .with('parameters', [
          {
            name: 'transactions',
            type: 'bytes',
            value: multiSendData,
            valueDecoded: [
              {
                operation: 0,
                to: mockRecipientAddress,
                value: generateRandomWeiAmount().toString(),
                data: faker.string.hexadecimal() as Hex,
                dataDecoded: mockDataDecoded,
              },
              {
                operation: 0,
                to: getAddress(faker.finance.ethereumAddress()),
                value: generateRandomWeiAmount().toString(),
                data: '0x',
                dataDecoded: null,
              },
            ],
          },
        ])
        .with('accuracy', 'FULL_MATCH')
        .build();

      const mockTransactionPreview = createTransactionPreviewMock({
        txInfo: createCustomTransactionInfo(
          mockRecipientAddress,
          multiSendData.length.toString(),
          '0',
          'multiSend',
          'MultiSend transaction',
        ),
        hexData: multiSendData,
        dataDecoded: multiSendDataDecoded,
        to: mockRecipientAddress,
      });

      mockTransactionsService.previewTransaction.mockResolvedValue(
        mockTransactionPreview,
      );
      mockRecipientAnalysisService.analyze.mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        tx: {
          to: mockRecipientAddress,
          data: multiSendData,
        },
      });

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockTransactionsService.previewTransaction).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        previewTransactionDto: {
          to: mockRecipientAddress,
          data: multiSendData,
          operation: Operation.CALL,
          value: '0',
        },
      });
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expect.arrayContaining([
          expect.objectContaining({
            to: mockRecipientAddress,
            data: multiSendData,
            dataDecoded: multiSendDataDecoded,
            operation: Operation.CALL,
            value: '0',
          }),
        ]),
      });
    });

    it('should handle transaction preview failure gracefully', async () => {
      const testData: Hex = faker.string.hexadecimal({ length: 128 }) as Hex;

      mockTransactionsService.previewTransaction.mockRejectedValue(
        new Error('Failed to decode transaction'),
      );

      const result = await service.analyzeRecipient({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        tx: {
          to: mockRecipientAddress,
          data: testData,
        },
      });

      expect(result).toEqual({});
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to decode transaction'),
      );
      expect(mockRecipientAnalysisService.analyze).not.toHaveBeenCalled();
    });

    it.each([
      {
        description: 'empty data (0x)',
        data: '0x' as Hex,
        dataDecoded: null,
        expectedDataDecoded: null,
      },
      {
        description: 'valid transaction data',
        data: faker.string.hexadecimal({ length: 128 }) as Hex,
        dataDecoded: dataDecodedBuilder().with('method', 'transfer').build(),
        expectedDataDecoded: expect.objectContaining({ method: 'transfer' }),
      },
    ])(
      'should handle transaction with $description',
      async ({ data, dataDecoded, expectedDataDecoded }) => {
        const mockTransactionPreview = createTransactionPreviewMock({
          txInfo: createTransferTransactionInfo(
            mockSafeAddress,
            mockRecipientAddress,
          ),
          hexData: data,
          dataDecoded,
          to: mockRecipientAddress,
        });

        mockTransactionsService.previewTransaction.mockResolvedValue(
          mockTransactionPreview,
        );
        mockRecipientAnalysisService.analyze.mockResolvedValue(
          mockRecipientAnalysisResponse,
        );

        const result = await service.analyzeRecipient({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          tx: {
            to: mockRecipientAddress,
            data,
          },
        });

        expect(result).toEqual(mockRecipientAnalysisResponse);
        expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          transactions: [
            expect.objectContaining({
              to: mockRecipientAddress,
              data,
              dataDecoded: expectedDataDecoded,
            }),
          ],
        });
      },
    );

    it('should handle recipient analysis service failure', async () => {
      const error = new Error('Recipient analysis failed');

      const mockTransactionPreview = createTransactionPreviewMock({
        txInfo: createTransferTransactionInfo(
          mockSafeAddress,
          mockRecipientAddress,
        ),
        hexData: mockData,
        dataDecoded: mockDataDecoded,
        to: mockRecipientAddress,
      });

      mockTransactionsService.previewTransaction.mockResolvedValue(
        mockTransactionPreview,
      );
      mockRecipientAnalysisService.analyze.mockRejectedValue(error);

      await expect(
        service.analyzeRecipient({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          tx: {
            to: mockRecipientAddress,
            data: mockData,
          },
        }),
      ).rejects.toThrow('Recipient analysis failed');
    });

    it.each([
      {
        description: 'custom value and DELEGATE operation',
        value: generateRandomWeiAmount(),
        operation: Operation.DELEGATE,
      },
      {
        description: 'zero value and CALL operation',
        value: BigInt(0),
        operation: Operation.CALL,
      },
      {
        description: 'large value and CALL operation',
        value: BigInt('999999999999999999999'),
        operation: Operation.CALL,
      },
    ])(
      'should handle transaction with $description',
      async ({ value, operation }) => {
        const mockTransactionPreview = createTransactionPreviewMock({
          txInfo: createCustomTransactionInfo(
            mockRecipientAddress,
            mockData.length.toString(),
            value.toString(),
          ),
          hexData: mockData,
          dataDecoded: mockDataDecoded,
          to: mockRecipientAddress,
          value: value.toString(),
          operation,
        });

        mockTransactionsService.previewTransaction.mockResolvedValue(
          mockTransactionPreview,
        );
        mockRecipientAnalysisService.analyze.mockResolvedValue(
          mockRecipientAnalysisResponse,
        );

        const result = await service.analyzeRecipient({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          tx: {
            to: mockRecipientAddress,
            data: mockData,
            value,
            operation,
          },
        });

        expect(result).toEqual(mockRecipientAnalysisResponse);
        expect(mockTransactionsService.previewTransaction).toHaveBeenCalledWith(
          {
            chainId: mockChainId,
            safeAddress: mockSafeAddress,
            previewTransactionDto: {
              to: mockRecipientAddress,
              data: mockData,
              value: value.toString(),
              operation,
            },
          },
        );
      },
    );
  });
});
