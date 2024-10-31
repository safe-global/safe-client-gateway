import type { IEncoder } from '@/__tests__/encoder-builder';
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import {
  encodeAbiParameters,
  encodeEventTopics,
  getAbiItem,
  getAddress,
  keccak256,
  toBytes,
} from 'viem';
import { Builder } from '@/__tests__/builder';
import { TRANSACTION_ADDED_ABI } from '@/domain/alerts/contracts/decoders/delay-modifier-decoder.helper';

// TransactionAdded

type TransactionAddedEventArgs = {
  queueNonce: bigint;
  txHash: Hex;
  to: Hex;
  value: bigint;
  data: Hex;
  operation: 0 | 1;
};

type TransactionAddedEvent = {
  data: Hex;
  topics: [signature: Hex, ...args: Array<Hex>];
};

class TransactionAddedEventBuilder<T extends TransactionAddedEventArgs>
  extends Builder<T>
  implements IEncoder<TransactionAddedEvent>
{
  private readonly item = getAbiItem({
    abi: TRANSACTION_ADDED_ABI,
    name: 'TransactionAdded',
  });

  encode(): TransactionAddedEvent {
    const args = this.build();

    const data = encodeAbiParameters(
      // Only non-indexed parameters
      this.item.inputs.filter((input) => {
        return !('indexed' in input) || !input.indexed;
      }),
      [args.to, args.value, args.data, args.operation],
    );

    const topics = encodeEventTopics({
      abi: TRANSACTION_ADDED_ABI,
      eventName: 'TransactionAdded',
      args: {
        // Only indexed params
        queueNonce: args.queueNonce,
        txHash: args.txHash,
      },
    }) as TransactionAddedEvent['topics'];

    return {
      data,
      topics,
    };
  }
}

export function transactionAddedEventBuilder(): TransactionAddedEventBuilder<TransactionAddedEventArgs> {
  return new TransactionAddedEventBuilder()
    .with('queueNonce', faker.number.bigInt())
    .with(
      'txHash',
      keccak256(toBytes(faker.string.hexadecimal({ length: 64 }))),
    )
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', BigInt(0))
    .with('data', '0x')
    .with('operation', 0);
}
