// DepositEvent

import { Builder } from '@/__tests__/builder';
import type { IEncoder } from '@/__tests__/encoder-builder';
import {
  KilnAbi,
  KilnDecoder,
} from '@/domain/staking/contracts/decoders/kiln-decoder.helper';
import { faker } from '@faker-js/faker/.';
import {
  encodeAbiParameters,
  encodeEventTopics,
  toHex,
  encodeFunctionData,
  getAbiItem,
  getAddress,
} from 'viem';

// deposit

type DepositArgs = never;

class DepositEncoder<T extends DepositArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    return encodeFunctionData({
      abi: KilnAbi,
      functionName: 'deposit',
      args: [],
    });
  }
}

export function depositEncoder(): DepositEncoder<DepositArgs> {
  return new DepositEncoder();
}

// requestValidatorsExit

type RequestValidatorsExitArgs = {
  _publicKeys: `0x${string}`;
};

class RequestValidatorsExitEncoder<T extends RequestValidatorsExitArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    const args = this.build();

    return encodeFunctionData({
      abi: KilnAbi,
      functionName: 'requestValidatorsExit',
      args: [args._publicKeys],
    });
  }
}

export function requestValidatorsExitEncoder(): RequestValidatorsExitEncoder<RequestValidatorsExitArgs> {
  return new RequestValidatorsExitEncoder().with(
    '_publicKeys',
    toHex(
      faker.string.hexadecimal({
        length: KilnDecoder.KilnPublicKeyLength,
      }),
    ),
  );
}

// batchWithdrawCLFee

type BatchWithdrawCLFeeArgs = {
  _publicKeys: `0x${string}`;
};

class BatchWithdrawCLFeeEncoder<T extends BatchWithdrawCLFeeArgs>
  extends Builder<T>
  implements IEncoder
{
  encode(): `0x${string}` {
    const args = this.build();

    return encodeFunctionData({
      abi: KilnAbi,
      functionName: 'batchWithdrawCLFee',
      args: [args._publicKeys],
    });
  }
}

export function batchWithdrawCLFeeEncoder(): BatchWithdrawCLFeeEncoder<BatchWithdrawCLFeeArgs> {
  return new BatchWithdrawCLFeeEncoder().with(
    '_publicKeys',
    toHex(
      faker.string.hexadecimal({
        length: KilnDecoder.KilnPublicKeyLength,
      }),
    ),
  );
}

// DepositEvent

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
  encode(): DepositEventEvent {
    const item = getAbiItem({ abi: KilnAbi, name: 'DepositEvent' });

    const args = this.build();

    // No parameters are indexed so we can use them directly
    const data = encodeAbiParameters(item.inputs, [
      args.pubkey,
      args.withdrawal_credentials,
      args.amount,
      args.signature,
      args.index,
    ]);

    const topics = encodeEventTopics({
      abi: KilnAbi,
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

// Withdrawal

type WithdrawalArgs = {
  withdrawer: `0x${string}`;
  feeRecipient: `0x${string}`;
  pubKeyRoot: `0x${string}`;
  rewards: bigint;
  nodeOperatorFee: bigint;
  treasuryFee: bigint;
};

type Withdrawal = {
  data: `0x${string}`;
  topics: [signature: `0x${string}`, ...args: Array<`0x${string}`>];
};

class WithdrawalEventBuilder<T extends WithdrawalArgs>
  extends Builder<T>
  implements IEncoder<Withdrawal>
{
  private readonly item = getAbiItem({
    abi: KilnAbi,
    name: 'Withdrawal',
  });

  encode(): Withdrawal {
    const args = this.build();

    const data = encodeAbiParameters(
      // Only non-indexed parameters
      this.item.inputs.filter((input) => {
        return !('indexed' in input) || !input.indexed;
      }),
      [args.pubKeyRoot, args.rewards, args.nodeOperatorFee, args.treasuryFee],
    );

    const topics = encodeEventTopics({
      abi: KilnAbi,
      eventName: 'Withdrawal',
      args: {
        // Only indexed parameters
        withdrawer: args.withdrawer,
        feeRecipient: args.feeRecipient,
      },
    }) as Withdrawal['topics'];

    return {
      data,
      topics,
    };
  }
}

export function withdrawalEventBuilder(): WithdrawalEventBuilder<WithdrawalArgs> {
  return new WithdrawalEventBuilder()
    .with('withdrawer', getAddress(faker.finance.ethereumAddress()))
    .with('feeRecipient', getAddress(faker.finance.ethereumAddress()))
    .with(
      'pubKeyRoot',
      toHex(
        faker.string.hexadecimal({
          length: 30,
        }),
      ),
    )
    .with('rewards', faker.number.bigInt())
    .with('nodeOperatorFee', BigInt(0))
    .with('treasuryFee', faker.number.bigInt());
}
