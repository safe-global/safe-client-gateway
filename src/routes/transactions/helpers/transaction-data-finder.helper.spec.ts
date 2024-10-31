import {
  multiSendEncoder,
  multiSendTransactionsEncoder,
} from '@/domain/contracts/__tests__/encoders/multi-send-encoder.builder';
import { MultiSendDecoder } from '@/domain/contracts/decoders/multi-send-decoder.helper';
import type { ILoggingService } from '@/logging/logging.interface';
import { TransactionFinder } from '@/routes/transactions/helpers/transaction-finder.helper';
import { faker } from '@faker-js/faker';
import { encodeFunctionData, erc20Abi, getAddress } from 'viem';

const mockLoggingService = {
  warn: jest.fn(),
} as jest.MockedObjectDeep<ILoggingService>;

describe('TransactionFinder', () => {
  let target: TransactionFinder;

  beforeEach(() => {
    jest.resetAllMocks();
    const multiSendDecoder = new MultiSendDecoder(mockLoggingService);
    target = new TransactionFinder(multiSendDecoder);
  });

  it('should return the given transaction data if it is the expected one', () => {
    const transaction = {
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [getAddress(faker.finance.ethereumAddress()), BigInt(0)],
      }),
      value: faker.string.numeric(),
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isTransactionData = (_: unknown): boolean => true;

    const result = target.findTransaction(isTransactionData, transaction);

    expect(result).toStrictEqual({
      data: transaction.data,
      value: transaction.value,
    });
  });

  it('should return the transaction data if it is found in a MultiSend transaction', () => {
    const transaction = {
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [getAddress(faker.finance.ethereumAddress()), BigInt(0)],
      }),
      to: getAddress(faker.finance.ethereumAddress()),
      operation: 0,
      value: faker.number.bigInt(),
    };
    const multiSend = multiSendEncoder().with(
      'transactions',
      multiSendTransactionsEncoder([transaction]),
    );
    const isTransactionData = (args: { data: `0x${string}` }): boolean => {
      return args.data === transaction.data;
    };

    const result = target.findTransaction(isTransactionData, {
      data: multiSend.encode(),
      value: faker.string.numeric(),
    });

    expect(result).toStrictEqual({
      to: transaction.to,
      data: transaction.data,
      value: transaction.value.toString(),
    });
  });

  it('should return null if the transaction data is not found', () => {
    const transaction = {
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: 'transfer',
        args: [getAddress(faker.finance.ethereumAddress()), BigInt(0)],
      }),
      value: faker.string.numeric(),
    };
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const isTransactionData = (_: unknown): boolean => false;

    const result = target.findTransaction(isTransactionData, transaction);

    expect(result).toBe(null);
  });
});
