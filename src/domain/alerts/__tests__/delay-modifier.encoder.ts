import { faker } from '@faker-js/faker';
import {
  Hex,
  encodeAbiParameters,
  encodeEventTopics,
  getAddress,
  parseAbi,
  parseAbiParameters,
} from 'viem';

// TransactionAdded

type TransactionAddedEventArgs = {
  queueNonce: bigint;
  txHash: string;
  to: string;
  value: bigint;
  data: string;
  operation: 0 | 1;
};

class TransactionAddedEventBuilder<T extends TransactionAddedEventArgs> {
  static readonly NON_INDEXED_PARAMS =
    'address to, uint256 value, bytes data, uint8 operation' as const;
  static readonly EVENT_SIGNATURE =
    `event TransactionAdded(uint256 indexed queueNonce, bytes32 indexed txHash, ${TransactionAddedEventBuilder.NON_INDEXED_PARAMS})` as const;

  private constructor(private args: Partial<T>) {}

  public static new<
    T extends TransactionAddedEventArgs,
  >(): TransactionAddedEventBuilder<T> {
    return new TransactionAddedEventBuilder<T>({});
  }

  with<K extends keyof T>(key: K, value: T[K]) {
    const args: Partial<T> = { ...this.args, [key]: value };
    return new TransactionAddedEventBuilder(args);
  }

  build() {
    const abi = parseAbi([TransactionAddedEventBuilder.EVENT_SIGNATURE]);

    const data = encodeAbiParameters(
      parseAbiParameters(TransactionAddedEventBuilder.NON_INDEXED_PARAMS),
      [
        getAddress(this.args.to!),
        this.args.value!,
        this.args.data as Hex,
        this.args.operation!,
      ],
    );

    const topics = encodeEventTopics({
      abi,
      eventName: 'TransactionAdded',
      args: {
        queueNonce: this.args.queueNonce!,
        txHash: this.args.txHash! as Hex,
      },
    });

    return {
      data,
      topics,
    };
  }
}

export function transactionAddedEventBuilder() {
  return TransactionAddedEventBuilder.new<TransactionAddedEventArgs>()
    .with('queueNonce', faker.number.bigInt())
    .with('txHash', faker.string.hexadecimal({ length: 64 }))
    .with('to', faker.finance.ethereumAddress())
    .with('value', BigInt(0))
    .with('data', '0x')
    .with('operation', 0);
}
