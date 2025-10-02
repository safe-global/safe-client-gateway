import type { Erc20Decoder } from '@/domain/relay/contracts/decoders/erc-20-decoder.helper';
import type { DecodedTransactionData } from '@/modules/safe-shield/entities/transaction-data.entity';
import { extractContracts } from '@/modules/safe-shield/utils/extraction.utils';
import type {
  DataDecoded,
  DataDecodedParameter,
} from '@/routes/data-decode/entities/data-decoded.entity';
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

    it('ignores transactions without decoded data', () => {
      const result = extractContracts(
        [
          createTransaction({
            dataDecoded: null,
            operation: 1,
          }),
        ],
        mockErc20Decoder,
      );

      expect(result).toEqual([]);
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
});
