import type { Erc20Decoder } from '@/modules/relay/domain/contracts/decoders/erc-20-decoder.helper';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import {
  extractContracts,
  extractRecipient,
  extractRecipients,
} from '@/modules/safe-shield/utils/extraction.utils';
import type {
  DataDecoded,
  DataDecodedParameter,
} from '@/modules/data-decoder/routes/entities/data-decoded.entity';
import { faker } from '@faker-js/faker/.';
import { getAddress, type Address, type Hex } from 'viem';

const mockErc20Decoder = {
  helpers: {
    isTransfer: jest.fn(),
    isTransferFrom: jest.fn(),
  },
} as jest.MockedObjectDeep<Erc20Decoder>;

const createDataDecoded = (
  overrides: Partial<DataDecoded> = {},
): DataDecoded => ({
  method: 'upgradeImplementation',
  parameters: [],
  accuracy: 'UNKNOWN',
  ...overrides,
});

const createTransaction = (
  overrides: Partial<DecodedTransactionData> = {},
): DecodedTransactionData => ({
  data: '0x12345678' as Hex,
  dataDecoded: createDataDecoded(),
  to: getAddress(faker.finance.ethereumAddress()),
  operation: 0,
  value: faker.number.bigInt().toString(),
  ...overrides,
});

describe('extraction.utils', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('extractContracts', () => {
    it('returns unique contract addresses for contract interactions', () => {
      mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
      mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

      const contract2 = faker.finance.ethereumAddress() as Address;
      const transactions = [
        createTransaction({
          to: '0x0000000000000000000000000000000000000abc',
        }),
        createTransaction({
          to: '0x0000000000000000000000000000000000000ABC',
        }),
        createTransaction({
          to: contract2,
          dataDecoded: createDataDecoded({ method: 'setUp' }),
          data: '0x87654321' as Hex,
        }),
      ];

      const result = extractContracts(transactions, mockErc20Decoder);

      expect(result).toEqual([
        [getAddress('0x0000000000000000000000000000000000000abc'), false],
        [getAddress(contract2), false],
      ]);
    });

    it('ignores transactions with empty data payload', () => {
      const result = extractContracts(
        [
          createTransaction({
            data: '0x' as Hex,
          }),
        ],
        mockErc20Decoder,
      );

      expect(result).toEqual([]);
    });

    it('ignores transactions without data payload', () => {
      const result = extractContracts(
        [
          createTransaction({
            data: undefined,
          }),
        ],
        mockErc20Decoder,
      );

      expect(result).toEqual([]);
      expect(mockErc20Decoder.helpers.isTransfer).not.toHaveBeenCalled();
      expect(mockErc20Decoder.helpers.isTransferFrom).not.toHaveBeenCalled();
    });

    it('extracts contracts from transactions without decoded data but with valid data', () => {
      mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
      mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

      const contract = getAddress(faker.finance.ethereumAddress());
      const result = extractContracts(
        [
          createTransaction({
            to: contract,
            dataDecoded: null,
            operation: 1,
          }),
        ],
        mockErc20Decoder,
      );

      expect(result).toEqual([[contract, true]]);
    });

    it('ignores ERC20 transfer transactions', () => {
      mockErc20Decoder.helpers.isTransfer.mockReturnValue(true);

      const result = extractContracts([createTransaction()], mockErc20Decoder);

      expect(result).toEqual([]);
      expect(mockErc20Decoder.helpers.isTransfer).toHaveBeenCalledWith(
        '0x12345678',
      );
    });

    it('ignores ERC20 transferFrom transactions', () => {
      mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(true);

      const result = extractContracts([createTransaction()], mockErc20Decoder);

      expect(result).toEqual([]);
      expect(mockErc20Decoder.helpers.isTransferFrom).toHaveBeenCalledWith(
        '0x12345678',
      );
    });

    it('ignores execTransaction meta-transactions with empty inner data', () => {
      mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
      mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

      const dataParameter: DataDecodedParameter = {
        name: 'data',
        type: 'bytes',
        value: '0x',
        valueDecoded: null,
      };

      const result = extractContracts(
        [
          createTransaction({
            dataDecoded: createDataDecoded({
              method: 'execTransaction',
              parameters: [
                {
                  name: 'to',
                  type: 'address',
                  value: '0x0000000000000000000000000000000000000000',
                  valueDecoded: null,
                },
                {
                  name: 'value',
                  type: 'uint256',
                  value: '0',
                  valueDecoded: null,
                },
                dataParameter,
              ],
            }),
          }),
        ],
        mockErc20Decoder,
      );

      expect(result).toEqual([]);
    });

    it('filters transfers and exec meta-calls while preserving contract interactions', () => {
      mockErc20Decoder.helpers.isTransfer.mockImplementation(
        (data) => data === '0xtransfer',
      );
      mockErc20Decoder.helpers.isTransferFrom.mockImplementation(
        (data) => data === '0xtransferfrom',
      );

      const contract1 = faker.finance.ethereumAddress() as Address;
      const contract2 = faker.finance.ethereumAddress() as Address;

      const execDataParameter: DataDecodedParameter = {
        name: 'data',
        type: 'bytes',
        value: '0x',
        valueDecoded: null,
      };

      const transactions = [
        createTransaction({
          to: contract1,
          data: '0xaaaa' as Hex,
          dataDecoded: createDataDecoded({ method: 'withdraw' }),
        }),
        createTransaction({
          to: '0x0000000000000000000000000000000000000002' as Address,
          data: '0xtransfer' as Hex,
        }),
        createTransaction({
          to: '0x0000000000000000000000000000000000000003' as Address,
          dataDecoded: createDataDecoded({
            method: 'execTransaction',
            parameters: [
              {
                name: 'to',
                type: 'address',
                value: '0x0000000000000000000000000000000000000000',
                valueDecoded: null,
              },
              {
                name: 'value',
                type: 'uint256',
                value: '1000',
                valueDecoded: null,
              },
              execDataParameter,
            ],
          }),
        }),
        createTransaction({
          to: '0x0000000000000000000000000000000000000004' as Address,
          data: '0xtransferfrom' as Hex,
        }),
        createTransaction({
          to: contract2,
          data: '0xbbbb' as Hex,
          dataDecoded: createDataDecoded({ method: 'deleteAllowance' }),
        }),
      ];

      const result = extractContracts(transactions, mockErc20Decoder);

      expect(result).toEqual([
        [getAddress(contract1), false],
        [getAddress(contract2), false],
      ]);
    });

    it('deduplicates by address and overrides isDelegateCall flag if true', () => {
      mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
      mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

      const contract = getAddress(faker.finance.ethereumAddress());

      const transactions = [
        createTransaction({ to: contract, operation: 0 }),
        createTransaction({ to: contract, operation: 0 }),
        createTransaction({
          data: '0x' as Hex,
        }),
        createTransaction({ to: contract, operation: 1 }),
        createTransaction({ to: contract, operation: 1 }),
      ];

      const result = extractContracts(transactions, mockErc20Decoder);

      expect(result).toEqual([[contract, true]]);
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

      mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
      mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

      const result = extractRecipients(transactions, mockErc20Decoder);

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

      mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
      mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

      const result = extractRecipients(transactions, mockErc20Decoder);

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
              {
                name: 'to',
                type: 'address',
                value: expectedRecipient,
                valueDecoded: null,
              },
              {
                name: 'value',
                type: 'uint256',
                value: '1000000000000000000',
                valueDecoded: null,
              },
              { name: 'data', type: 'bytes', value: '0x', valueDecoded: null },
              {
                name: 'operation',
                type: 'uint256',
                value: '0',
                valueDecoded: null,
              },
            ],
            accuracy: 'FULL_MATCH',
          },
        };

        const result = extractRecipient(transaction, mockErc20Decoder);

        expect(result).toBe(expectedRecipient);
      });

      it('should not extract from execTransaction with non-empty data', () => {
        // Setup mock to return false for ERC-20 checks since data isn't recognized
        mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

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
                value: '0xa9059cbb',
                valueDecoded: null,
              }, // Non-empty data
              {
                name: 'operation',
                type: 'uint256',
                value: '0',
                valueDecoded: null,
              },
            ],
            accuracy: 'FULL_MATCH',
          },
        };

        const result = extractRecipient(transaction, mockErc20Decoder);

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
            parameters: [] as Array<never>, // Missing parameters - this will cause error when trying to access parameters[2]
            accuracy: 'FULL_MATCH',
          },
        };

        // This should throw because the function tries to access parameters[2].value on empty array
        expect(() => extractRecipient(transaction, mockErc20Decoder)).toThrow();
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
              {
                name: 'to',
                type: 'address',
                value: expectedRecipient,
                valueDecoded: null,
              },
              {
                name: 'value',
                type: 'uint256',
                value: '1000000000000000000',
                valueDecoded: null,
              },
            ],
            accuracy: 'FULL_MATCH',
          },
        };

        mockErc20Decoder.helpers.isTransfer.mockReturnValue(true);

        const result = extractRecipient(transaction, mockErc20Decoder);

        expect(result).toBe(expectedRecipient);
      });

      it('should handle transfer with missing parameters and throw error', () => {
        // Setup mocks
        mockErc20Decoder.helpers.isTransfer.mockReturnValue(true);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

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

        // This should fail because the function tries to access parameters[0].value on empty array
        expect(() => extractRecipient(transaction, mockErc20Decoder)).toThrow();
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
              {
                name: 'from',
                type: 'address',
                value: sender,
                valueDecoded: null,
              },
              {
                name: 'to',
                type: 'address',
                value: expectedRecipient,
                valueDecoded: null,
              },
              {
                name: 'value',
                type: 'uint256',
                value: '1000000000000000000',
                valueDecoded: null,
              },
            ],
            accuracy: 'FULL_MATCH',
          },
        };

        mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(true);

        const result = extractRecipient(transaction, mockErc20Decoder);

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

        mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

        const result = extractRecipient(transaction, mockErc20Decoder);

        expect(result).toBe(expectedRecipient);
      });

      it('should extract recipient from transaction.to for native transfer with null data', () => {
        const expectedRecipient = getAddress(faker.finance.ethereumAddress());

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: expectedRecipient,
          value: '1000000000000000000',
          data: null,
          dataDecoded: null,
        };

        mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

        const result = extractRecipient(transaction, mockErc20Decoder);

        expect(result).toBe(expectedRecipient);
      });

      it('should return undefined when dataDecoded is null and data is not empty', () => {
        const expectedRecipient = getAddress(faker.finance.ethereumAddress());

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: expectedRecipient,
          value: '1000000000000000000',
          data: '0xsomedata', // Non-empty data
          dataDecoded: null,
        };

        mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

        const result = extractRecipient(transaction, mockErc20Decoder);

        // Should return undefined because data is not '0x' and no ERC-20 patterns match
        expect(result).toBeUndefined();
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

        mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

        const result = extractRecipient(transaction, mockErc20Decoder);

        expect(result).toBeUndefined();
      });
    });
  });
});
