import { SafeShieldService } from './safe-shield.service';
import type { RecipientAnalysisService } from './recipient-analysis/recipient-analysis.service';
import type { ContractAnalysisService } from './contract-analysis/contract-analysis.service';
import type { ThreatAnalysisService } from './threat-analysis/threat-analysis.service';
import type { ILoggingService } from '@/logging/logging.interface';
import type { DataDecoded } from '@/routes/data-decode/entities/data-decoded.entity';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { RecipientAnalysisResponse } from './entities/analysis-responses.entity';
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
import {
  recipientAnalysisResponseBuilder,
  contractAnalysisResponseBuilder,
} from './entities/__tests__/builders/analysis-responses.builder';
import { dataDecodedBuilder } from '@/domain/data-decoder/v2/entities/__tests__/data-decoded.builder';
import {
  contractAnalysisResultBuilder,
  recipientAnalysisResultBuilder,
} from '@/modules/safe-shield/entities/__tests__/builders/analysis-result.builder';
import { Operation } from '@/domain/safe/entities/operation.entity';

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
    false,
    description,
  );

describe('SafeShieldService', () => {
  const mockRecipientAnalysisService = {
    analyze: jest.fn(),
    analyzeInteractions: jest.fn(),
  } as jest.MockedObjectDeep<RecipientAnalysisService>;
  const mockContractAnalysisService = {
    analyze: jest.fn(),
  } as jest.MockedObjectDeep<ContractAnalysisService>;
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
  const mockContractAddress = getAddress(faker.finance.ethereumAddress());
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

  const mockContractAnalysisResponse = contractAnalysisResponseBuilder()
    .with(mockContractAddress, {
      CONTRACT_VERIFICATION: [contractAnalysisResultBuilder().build()],
      CONTRACT_INTERACTION: [
        contractAnalysisResultBuilder().with('type', 'KNOWN_CONTRACT').build(),
      ],
      DELEGATECALL: [],
    })
    .build();

  describe('analyzeCounterparty', () => {
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

    it('should analyze counterparty for a simple transaction', async () => {
      const mockTxInfo = createTransferTransactionInfo(
        mockSafeAddress,
        mockRecipientAddress,
      );
      const mockTransactionPreview = createTransactionPreviewMock({
        txInfo: mockTxInfo,
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
      mockContractAnalysisService.analyze.mockResolvedValue({});

      const result = await service.analyzeCounterparty({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        tx: {
          to: mockRecipientAddress,
          data: mockData,
          value: '0',
          operation: Operation.CALL,
        },
      });

      expect(result).toEqual({
        recipient: mockRecipientAnalysisResponse,
        contract: {},
      });
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
        txInfo: mockTxInfo,
      });
      expect(mockContractAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expectedTransactions,
      });
    });

    it('should decode multiSend transaction into 2 separate transactions for analysis', async () => {
      const multiSendData: Hex =
        `0x8d80ff0a${faker.string.hexadecimal({ length: 256, casing: 'lower', prefix: '' })}` as Hex;

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
                data: mockData,
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'transfer')
                  .build(),
              },
              {
                operation: 0,
                to: mockContractAddress,
                value: '0',
                data: mockData,
                dataDecoded: dataDecodedBuilder()
                  .with('method', 'approve')
                  .build(),
              },
            ],
          },
        ])
        .with('accuracy', 'FULL_MATCH')
        .build();

      const mockTxInfo = createCustomTransactionInfo(
        mockRecipientAddress,
        multiSendData.length.toString(),
        '0',
        'multiSend',
        'MultiSend transaction',
      );
      const mockTransactionPreview = createTransactionPreviewMock({
        txInfo: mockTxInfo,
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
      mockContractAnalysisService.analyze.mockResolvedValue(
        mockContractAnalysisResponse,
      );

      const result = await service.analyzeCounterparty({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        tx: {
          to: mockRecipientAddress,
          data: multiSendData,
          value: '0',
          operation: Operation.CALL,
        },
      });

      expect(result).toEqual({
        recipient: mockRecipientAnalysisResponse,
        contract: mockContractAnalysisResponse,
      });

      // Verify that both services receive the 2 decoded inner transactions
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [
          expect.objectContaining({
            to: mockRecipientAddress,
            data: mockData,
            operation: 0,
            dataDecoded: expect.objectContaining({ method: 'transfer' }),
          }),
          expect.objectContaining({
            to: mockContractAddress,
            value: '0',
            data: mockData,
            operation: 0,
            dataDecoded: expect.objectContaining({ method: 'approve' }),
          }),
        ],
        txInfo: mockTxInfo,
      });

      expect(mockContractAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [
          expect.objectContaining({
            to: mockRecipientAddress,
            data: mockData,
            operation: 0,
            dataDecoded: expect.objectContaining({ method: 'transfer' }),
          }),
          expect.objectContaining({
            to: mockContractAddress,
            value: '0',
            data: mockData,
            operation: 0,
            dataDecoded: expect.objectContaining({ method: 'approve' }),
          }),
        ],
      });
    });

    it('should handle transaction preview failure gracefully', async () => {
      const testData: Hex = faker.string.hexadecimal({ length: 128 }) as Hex;

      mockTransactionsService.previewTransaction.mockRejectedValue(
        new Error('Failed to decode transaction'),
      );

      const result = await service.analyzeCounterparty({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        tx: {
          to: mockRecipientAddress,
          data: testData,
          value: '0',
          operation: Operation.CALL,
        },
      });

      expect(result).toEqual({
        recipient: {},
        contract: {},
      });
      expect(mockLoggingService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to decode transaction'),
      );
      expect(mockRecipientAnalysisService.analyze).not.toHaveBeenCalled();
      expect(mockContractAnalysisService.analyze).not.toHaveBeenCalled();
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
        const mockTxInfo = createTransferTransactionInfo(
          mockSafeAddress,
          mockRecipientAddress,
        );
        const mockTransactionPreview = createTransactionPreviewMock({
          txInfo: mockTxInfo,
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
        mockContractAnalysisService.analyze.mockResolvedValue({});

        const result = await service.analyzeCounterparty({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          tx: {
            to: mockRecipientAddress,
            data,
            value: '0',
            operation: Operation.CALL,
          },
        });

        expect(result).toEqual({
          recipient: mockRecipientAnalysisResponse,
          contract: {},
        });
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
          txInfo: mockTxInfo,
        });
        expect(mockContractAnalysisService.analyze).toHaveBeenCalledWith({
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

      const mockTxInfo = createTransferTransactionInfo(
        mockSafeAddress,
        mockRecipientAddress,
      );
      const mockTransactionPreview = createTransactionPreviewMock({
        txInfo: mockTxInfo,
        hexData: mockData,
        dataDecoded: mockDataDecoded,
        to: mockRecipientAddress,
      });

      mockTransactionsService.previewTransaction.mockResolvedValue(
        mockTransactionPreview,
      );
      mockRecipientAnalysisService.analyze.mockRejectedValue(error);
      mockContractAnalysisService.analyze.mockResolvedValue(
        mockContractAnalysisResponse,
      );

      await expect(
        service.analyzeCounterparty({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          tx: {
            to: mockRecipientAddress,
            data: mockData,
            value: '0',
            operation: Operation.CALL,
          },
        }),
      ).rejects.toThrow('Recipient analysis failed');

      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expect.arrayContaining([
          expect.objectContaining({
            to: mockRecipientAddress,
            data: mockData,
          }),
        ]),
        txInfo: mockTxInfo,
      });
      expect(mockContractAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expect.arrayContaining([
          expect.objectContaining({
            to: mockRecipientAddress,
            data: mockData,
          }),
        ]),
      });
    });

    it('should handle contract analysis service failure', async () => {
      const error = new Error('Contract analysis failed');

      const mockTxInfo = createTransferTransactionInfo(
        mockSafeAddress,
        mockRecipientAddress,
      );
      const mockTransactionPreview = createTransactionPreviewMock({
        txInfo: mockTxInfo,
        hexData: mockData,
        dataDecoded: mockDataDecoded,
        to: mockRecipientAddress,
      });

      mockTransactionsService.previewTransaction.mockResolvedValue(
        mockTransactionPreview,
      );
      mockRecipientAnalysisService.analyze.mockResolvedValue(
        mockRecipientAnalysisResponse,
      );
      mockContractAnalysisService.analyze.mockRejectedValue(error);

      await expect(
        service.analyzeCounterparty({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          tx: {
            to: mockRecipientAddress,
            data: mockData,
            value: '0',
            operation: Operation.CALL,
          },
        }),
      ).rejects.toThrow('Contract analysis failed');

      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expect.arrayContaining([
          expect.objectContaining({
            to: mockRecipientAddress,
            data: mockData,
          }),
        ]),
        txInfo: mockTxInfo,
      });
      expect(mockContractAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: expect.arrayContaining([
          expect.objectContaining({
            to: mockRecipientAddress,
            data: mockData,
          }),
        ]),
      });
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
        const mockTxInfo = createCustomTransactionInfo(
          mockRecipientAddress,
          mockData.length.toString(),
          value.toString(),
        );
        const mockTransactionPreview = createTransactionPreviewMock({
          txInfo: mockTxInfo,
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
        mockContractAnalysisService.analyze.mockResolvedValue(
          mockContractAnalysisResponse,
        );

        const result = await service.analyzeCounterparty({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          tx: {
            to: mockRecipientAddress,
            data: mockData,
            value: value.toString(),
            operation,
          },
        });

        expect(result).toEqual({
          recipient: mockRecipientAnalysisResponse,
          contract: mockContractAnalysisResponse,
        });
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
        expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          transactions: expect.arrayContaining([
            expect.objectContaining({
              to: mockRecipientAddress,
              data: mockData,
              dataDecoded: mockDataDecoded,
              operation,
            }),
          ]),
          txInfo: mockTxInfo,
        });
        expect(mockContractAnalysisService.analyze).toHaveBeenCalledWith({
          chainId: mockChainId,
          safeAddress: mockSafeAddress,
          transactions: expect.arrayContaining([
            expect.objectContaining({
              to: mockRecipientAddress,
              data: mockData,
              dataDecoded: mockDataDecoded,
              operation,
            }),
          ]),
        });
      },
    );
  });

  describe('analyzeRecipients', () => {
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

    const mockTxInfo = createTransferTransactionInfo(
      mockSafeAddress,
      mockRecipientAddress,
    );

    const mockTransactions: Array<DecodedTransactionData> = [
      {
        operation: Operation.CALL,
        to: mockRecipientAddress,
        value: '0',
        data: '0x',
        dataDecoded: mockDataDecoded,
      },
    ];

    it('should analyze recipients and return analysis response', async () => {
      mockRecipientAnalysisService.analyze.mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipients(
        mockChainId,
        mockSafeAddress,
        mockTransactions,
        mockTxInfo,
      );

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: mockTransactions,
        txInfo: mockTxInfo,
      });
    });

    it('should handle recipient analysis service failure', async () => {
      const error = new Error('Recipient analysis failed');
      mockRecipientAnalysisService.analyze.mockRejectedValue(error);

      await expect(
        service.analyzeRecipients(
          mockChainId,
          mockSafeAddress,
          mockTransactions,
        ),
      ).rejects.toThrow('Recipient analysis failed');

      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: mockTransactions,
        txInfo: undefined,
      });
    });

    it('should analyze recipients if transactions array is empty', async () => {
      mockRecipientAnalysisService.analyze.mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipients(
        mockChainId,
        mockSafeAddress,
        [],
        mockTxInfo,
      );

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: [],
        txInfo: mockTxInfo,
      });
    });

    it('should analyze recipients if txInfo is undefined', async () => {
      mockRecipientAnalysisService.analyze.mockResolvedValue(
        mockRecipientAnalysisResponse,
      );

      const result = await service.analyzeRecipients(
        mockChainId,
        mockSafeAddress,
        mockTransactions,
      );

      expect(result).toEqual(mockRecipientAnalysisResponse);
      expect(mockRecipientAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: mockTransactions,
        txInfo: undefined,
      });
    });

    it('should return empty response if transactions array is empty and txInfo is undefined', async () => {
      const result = await service.analyzeRecipients(
        mockChainId,
        mockSafeAddress,
        [],
      );

      expect(result).toEqual({});
      expect(mockRecipientAnalysisService.analyze).not.toHaveBeenCalled();
    });
  });

  describe('analyzeContracts', () => {
    const mockDataDecoded: DataDecoded = dataDecodedBuilder()
      .with('method', 'approve')
      .with('parameters', [
        {
          name: faker.word.sample(),
          type: 'address',
          value: faker.finance.ethereumAddress(),
          valueDecoded: null,
        },
        {
          name: faker.word.sample(),
          type: 'uint256',
          value: generateRandomWeiAmount().toString(),
          valueDecoded: null,
        },
      ])
      .with('accuracy', 'FULL_MATCH')
      .build();

    const mockTransactions: Array<DecodedTransactionData> = [
      {
        operation: Operation.CALL,
        to: mockContractAddress,
        value: '0',
        data: mockData,
        dataDecoded: mockDataDecoded,
      },
    ];

    it('should analyze contracts and return analysis response', async () => {
      mockContractAnalysisService.analyze.mockResolvedValue(
        mockContractAnalysisResponse,
      );

      const result = await service.analyzeContracts(
        mockChainId,
        mockSafeAddress,
        mockTransactions,
      );

      expect(result).toEqual(mockContractAnalysisResponse);
      expect(mockContractAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: mockTransactions,
      });
    });

    it('should handle contract analysis service failure', async () => {
      const error = new Error('Contract analysis failed');
      mockContractAnalysisService.analyze.mockRejectedValue(error);

      await expect(
        service.analyzeContracts(
          mockChainId,
          mockSafeAddress,
          mockTransactions,
        ),
      ).rejects.toThrow('Contract analysis failed');

      expect(mockContractAnalysisService.analyze).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        transactions: mockTransactions,
      });
    });

    it('should return empty response if transactions array is empty', async () => {
      const result = await service.analyzeContracts(
        mockChainId,
        mockSafeAddress,
        [],
      );

      expect(result).toEqual({});
      expect(mockContractAnalysisService.analyze).not.toHaveBeenCalled();
    });
  });

  describe('analyzeRecipient', () => {
    it('should analyze a single recipient address', async () => {
      const mockInteractionResult =
        recipientAnalysisResultBuilder().build() as AnalysisResult<RecipientStatus>;

      mockRecipientAnalysisService.analyzeInteractions.mockResolvedValue(
        mockInteractionResult,
      );

      const result = await service.analyzeRecipient(
        mockChainId,
        mockSafeAddress,
        mockRecipientAddress,
      );

      expect(result).toEqual({
        RECIPIENT_INTERACTION: [mockInteractionResult],
      });
      expect(
        mockRecipientAnalysisService.analyzeInteractions,
      ).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });
    });

    it('should handle analyzeInteractions failure', async () => {
      const error = new Error('Failed to analyze interactions');

      mockRecipientAnalysisService.analyzeInteractions.mockRejectedValue(error);

      await expect(
        service.analyzeRecipient(
          mockChainId,
          mockSafeAddress,
          mockRecipientAddress,
        ),
      ).rejects.toThrow('Failed to analyze interactions');

      expect(
        mockRecipientAnalysisService.analyzeInteractions,
      ).toHaveBeenCalledWith({
        chainId: mockChainId,
        safeAddress: mockSafeAddress,
        recipient: mockRecipientAddress,
      });
    });
  });
});
