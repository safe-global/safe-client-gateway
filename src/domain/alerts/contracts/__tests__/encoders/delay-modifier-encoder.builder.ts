import type { IEncoder } from '@/__tests__/encoder-builder';
import { faker } from '@faker-js/faker';
import type { Hex } from 'viem';
import {
  encodeAbiParameters,
  encodeEventTopics,
  encodeFunctionData,
  getAbiItem,
  getAddress,
  keccak256,
  toBytes,
} from 'viem';
import { Builder } from '@/__tests__/builder';
import { DelayModifierAbi } from '@/domain/alerts/contracts/decoders/delay-modifier-decoder.helper';

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
    abi: DelayModifierAbi,
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
      abi: DelayModifierAbi,
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

// execTransactionFromModule

type ExecTransactionFromModuleArgs = {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  operation: 0 | 1;
};

class ExecTransactionFromModuleEncoder<T extends ExecTransactionFromModuleArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    const args = this.build();

    return encodeFunctionData({
      abi: DelayModifierAbi,
      functionName: 'execTransactionFromModule',
      args: [args.to, args.value, args.data, args.operation],
    });
  }
}

export function execTransactionFromModuleEncoder(): ExecTransactionFromModuleEncoder<ExecTransactionFromModuleArgs> {
  return new ExecTransactionFromModuleEncoder()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.number.bigInt())
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('operation', faker.helpers.arrayElement([0, 1]));
}

// executeNextTx

type ExecNextTxArgs = {
  to: `0x${string}`;
  value: bigint;
  data: `0x${string}`;
  operation: 0 | 1;
};

class ExecNextTxEncoder<T extends ExecNextTxArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    const args = this.build();

    return encodeFunctionData({
      abi: DelayModifierAbi,
      functionName: 'executeNextTx',
      args: [args.to, args.value, args.data, args.operation],
    });
  }
}

export function executeNextTxEncoder(): ExecNextTxEncoder<ExecNextTxArgs> {
  return new ExecNextTxEncoder()
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('value', faker.number.bigInt())
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('operation', faker.helpers.arrayElement([0, 1]));
}
