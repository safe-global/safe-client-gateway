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
  transactions: Array<{
    operation: number;
    to: string;
    value: bigint;
    data: string;
  }>;
};

class MultiSendEncoder<T extends MultiSendArgs> {
  static readonly FUNCTION_SIGNATURE =
    'function multiSend(bytes memory transactions)' as const;

  private constructor(private args: Partial<T>) {}

  public static new<T extends MultiSendArgs>(): MultiSendEncoder<T> {
    return new MultiSendEncoder<T>({});
  }

  with<K extends keyof T>(key: K, value: T[K]) {
    const args: Partial<T> = { ...this.args, [key]: value };
    return new MultiSendEncoder(args);
  }

  build() {
    const encodedTransactions = this.args.transactions!.map(
      ({ operation, to, value, data }) => {
        const _data = data as Hex;
        return encodePacked(
          ['uint8', 'address', 'uint256', 'uint256', 'bytes'],
          [operation, getAddress(to), value, BigInt(size(_data)), _data],
        );
      },
    );

    return {
      transactions: concat(encodedTransactions),
    };
  }

  encode(): Hex {
    const abi = parseAbi([MultiSendEncoder.FUNCTION_SIGNATURE]);

    const { transactions } = this.build();

    return encodeFunctionData({
      abi,
      functionName: 'multiSend',
      args: [transactions],
    });
  }
}

export function multiSendEncoder() {
  return MultiSendEncoder.new<MultiSendArgs>().with('transactions', [
    {
      operation: 0,
      to: faker.finance.ethereumAddress(),
      value: BigInt(0),
      data: '0x',
    },
  ]);
}
