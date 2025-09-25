import { extractRecipients, extractRecipient } from '../recipient-extraction.utils';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

describe('recipient-extraction.utils', () => {
  const mockErc20Decoder = {
    helpers: {
      isTransfer: jest.fn(),
      isTransferFrom: jest.fn(),
    },
  } as jest.MockedObjectDeep<Erc20Decoder>;

  beforeEach(() => {
    jest.resetAllMocks();
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
              { name: 'to', type: 'address', value: expectedRecipient },
              { name: 'value', type: 'uint256', value: '1000000000000000000' },
              { name: 'data', type: 'bytes', value: '0x' },
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
              },
              { name: 'value', type: 'uint256', value: '1000000000000000000' },
              { name: 'data', type: 'bytes', value: '0xa9059cbb' }, // Non-empty data
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
            parameters: [], // Missing parameters - this will cause error when trying to access parameters[2]
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
              { name: 'to', type: 'address', value: expectedRecipient },
              { name: 'value', type: 'uint256', value: '1000000000000000000' },
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
              { name: 'from', type: 'address', value: sender },
              { name: 'to', type: 'address', value: expectedRecipient },
              { name: 'value', type: 'uint256', value: '1000000000000000000' },
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

      it('should extract recipient from transaction.to when dataDecoded is null', () => {
        const expectedRecipient = getAddress(faker.finance.ethereumAddress());

        const transaction: DecodedTransactionData = {
          operation: 0,
          to: expectedRecipient,
          value: '1000000000000000000',
          data: '0xsomedata',
          dataDecoded: null,
        };

        mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

        const result = extractRecipient(transaction, mockErc20Decoder);

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

        mockErc20Decoder.helpers.isTransfer.mockReturnValue(false);
        mockErc20Decoder.helpers.isTransferFrom.mockReturnValue(false);

        const result = extractRecipient(transaction, mockErc20Decoder);

        expect(result).toBeUndefined();
      });
    });
  });
});
