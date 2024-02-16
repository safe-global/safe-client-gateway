import { IEncoder } from '@/__tests__/encoder-builder';
import { faker } from '@faker-js/faker';
import {
  concat,
  encodeFunctionData,
  encodePacked,
  getAddress,
  Hex,
  size,
} from 'viem';
import MultiSendCallOnly130 from '@/dist/abis/safe/v1.3.0/MultiSendCallOnly.abi';
import { Builder } from '@/__tests__/builder';

// multiSend

type MultiSendArgs = {
  transactions: Hex;
};

class MultiSendEncoder<T extends MultiSendArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): Hex {
    const args = this.build();

    return encodeFunctionData({
      abi: MultiSendCallOnly130,
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

export function multiSendEncoder(): MultiSendEncoder<MultiSendArgs> {
  const transactions = multiSendTransactionsEncoder([
    {
      operation: 0,
      to: getAddress(faker.finance.ethereumAddress()),
      value: BigInt(0),
      data: '0x',
    },
  ]);

  return new MultiSendEncoder().with('transactions', transactions);
}
