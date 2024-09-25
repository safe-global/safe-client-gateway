// DepositEvent

import { Builder } from '@/__tests__/builder';
import { IEncoder } from '@/__tests__/encoder-builder';
import { KilnDecoder } from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { faker } from '@faker-js/faker/.';
import {
  parseAbi,
  encodeAbiParameters,
  parseAbiParameters,
  encodeEventTopics,
  toHex,
} from 'viem';

type DepositEventEventArgs = {
  pubkey: `0x${string}`;
  withdrawal_credentials: `0x${string}`;
  amount: `0x${string}`;
  signature: `0x${string}`;
  index: `0x${string}`;
};

type DepositEventEvent = {
  data: `0x${string}`;
  topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>];
};

class DepositEventBuilder<T extends DepositEventEventArgs>
  extends Builder<T>
  implements IEncoder<DepositEventEvent>
{
  static readonly NON_INDEXED_PARAMS =
    'bytes pubkey, bytes withdrawal_credentials, bytes amount, bytes signature, bytes index' as const;
  static readonly EVENT_SIGNATURE =
    `event DepositEvent(${DepositEventBuilder.NON_INDEXED_PARAMS})` as const;

  encode(): DepositEventEvent {
    const abi = parseAbi([DepositEventBuilder.EVENT_SIGNATURE]);

    const args = this.build();

    const data = encodeAbiParameters(
      parseAbiParameters(DepositEventBuilder.NON_INDEXED_PARAMS),
      [
        args.pubkey,
        args.withdrawal_credentials,
        args.amount,
        args.signature,
        args.index,
      ],
    );

    const topics = encodeEventTopics({
      abi,
      eventName: 'DepositEvent',
      args: {
        pubkey: args.pubkey,
        withdrawal_credentials: args.withdrawal_credentials,
        amount: args.amount,
        signature: args.signature,
        index: args.index,
      },
    }) as DepositEventEvent['topics'];

    return {
      data,
      topics,
    };
  }
}

export function depositEventEventBuilder(): DepositEventBuilder<DepositEventEventArgs> {
  return new DepositEventBuilder()
    .with(
      'pubkey',
      toHex(
        faker.string.hexadecimal({
          length: KilnDecoder.KilnPublicKeyLength,
        }),
      ),
    )
    .with(
      'withdrawal_credentials',
      toHex(faker.string.hexadecimal({ length: 64 })),
    )
    .with('amount', toHex(faker.string.hexadecimal({ length: 16 })))
    .with('signature', toHex(faker.string.hexadecimal({ length: 192 })))
    .with('index', toHex(faker.string.hexadecimal({ length: 16 })));
}
