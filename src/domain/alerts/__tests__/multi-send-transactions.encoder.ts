import { EncoderBuilder, IEncoderBuilder } from '@/__tests__/encoder-builder';
import { faker } from '@faker-js/faker';
import {
  Hex,
  concat,
  encodeFunctionData,
  encodePacked,
  getAddress,
  parseAbi,
  size,
} from 'viem';

// multiSend

type MultiSendArgs = {
  transactions: Hex;
};

class MultiSendEncoder<T extends MultiSendArgs> extends EncoderBuilder<T> {
  static readonly FUNCTION_SIGNATURE =
    'function multiSend(bytes memory transactions)' as const;

  encode() {
    const abi = parseAbi([MultiSendEncoder.FUNCTION_SIGNATURE]);

    const args = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'multiSend',
      args: [args.transactions],
    });
  }
}

export function multiSendTransactionsEncoder(
  transactions: Array<{
    operation: number;
    to: Hex;
    value: bigint;
    data: Hex;
  }>,
): Hex {
  const encodedTransactions = transactions.map(
    ({ operation, to, value, data }) => {
      return encodePacked(
        ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
        [operation, to, value, BigInt(size(data)), data],
      );
    },
  );

  return concat(encodedTransactions);
}

export function multiSendEncoder(): IEncoderBuilder<MultiSendArgs> {
  const transactions = multiSendTransactionsEncoder([
    {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x',
    },
  ]);

  return MultiSendEncoder.new<MultiSendArgs>().with(
    'transactions',
    transactions,
  );
}
