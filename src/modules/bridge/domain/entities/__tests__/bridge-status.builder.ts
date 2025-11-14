import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import {
  SubstatusesDone,
  SubstatusesFailed,
  SubstatusesPending,
} from '@/modules/bridge/domain/entities/bridge-status.entity';
import type { IBuilder } from '@/__tests__/builder';
import type {
  BaseTransactionInfo,
  BridgeStatus,
  ExtendedTransactionInfo,
  FailedStatusData,
  PendingStatusData,
  SuccessStatusData,
  PendingReceivingInfo,
  TransferMetadata,
} from '@/modules/bridge/domain/entities/bridge-status.entity';
import { tokenBuilder } from '@/modules/bridge/domain/entities/__tests__/token.builder';
import type { Address, Hash, Hex } from 'viem';

export function baseStatusDataBuilder<
  T extends SuccessStatusData | FailedStatusData | PendingStatusData,
>(): IBuilder<T> {
  return new Builder<T>()
    .with(
      'substatus',
      faker.helpers.arrayElement([
        ...SubstatusesPending,
        ...SubstatusesDone,
        ...SubstatusesFailed,
      ]),
    )
    .with('substatusMessage', faker.lorem.sentence());
}

export function baseTransactionInfoBuilder<
  T extends BaseTransactionInfo | ExtendedTransactionInfo = BaseTransactionInfo,
>(): IBuilder<T> {
  return new Builder<T>()
    .with('txHash', faker.string.hexadecimal({ length: 64 }) as Hash)
    .with('chainId', faker.string.numeric())
    .with('txLink', faker.internet.url({ appendSlash: false }));
}

export function pendingReceivingInfoBuilder(): IBuilder<PendingReceivingInfo> {
  return new Builder<PendingReceivingInfo>().with(
    'chainId',
    faker.string.numeric(),
  );
}

export function extendedTransactionInfoBuilder<
  T extends ExtendedTransactionInfo = ExtendedTransactionInfo,
>(): IBuilder<T> {
  return baseTransactionInfoBuilder<T>()
    .with('amount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('token', tokenBuilder().build())
    .with('gasPrice', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('gasUsed', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('gasToken', tokenBuilder().build())
    .with('gasAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('timestamp', faker.number.int())
    .with('value', faker.number.float({ min: 0, max: 1_000 }).toString());
}

export function transferMetadataBuilder(): IBuilder<TransferMetadata> {
  return new Builder<TransferMetadata>().with(
    'integrator',
    faker.word.sample(),
  );
}

export function successStatusDataBuilder<
  T extends SuccessStatusData = SuccessStatusData,
>(): IBuilder<T> {
  return baseStatusDataBuilder<T>()
    .with('status', 'DONE')
    .with('toAddress', faker.finance.ethereumAddress() as Address)
    .with('fromAddress', faker.finance.ethereumAddress() as Address)
    .with('substatus', faker.helpers.arrayElement([...SubstatusesDone]))
    .with('receiving', extendedTransactionInfoBuilder().build())
    .with('transactionId', faker.string.hexadecimal({ length: 64 }) as Hex)
    .with('metadata', transferMetadataBuilder().build())
    .with('bridgeExplorerLink', faker.internet.url({ appendSlash: false }))
    .with('lifiExplorerLink', faker.internet.url({ appendSlash: false }));
}

export function pendingStatusDataBuilder<
  T extends PendingStatusData = PendingStatusData,
>(): IBuilder<T> {
  return baseStatusDataBuilder<T>()
    .with('status', 'PENDING')
    .with('substatus', faker.helpers.arrayElement([...SubstatusesPending]));
}

export function failedStatusDataBuilder<
  T extends FailedStatusData = FailedStatusData,
>(): IBuilder<T> {
  return baseStatusDataBuilder<T>()
    .with(
      'status',
      faker.helpers.arrayElement(['FAILED', 'INVALID', 'NOT_FOUND']),
    )
    .with('substatus', faker.helpers.arrayElement([...SubstatusesFailed]))
    .with('sending', baseTransactionInfoBuilder().build());
}

export function bridgeStatusBuilder(): IBuilder<BridgeStatus> {
  return faker.helpers.arrayElement([
    successStatusDataBuilder(),
    pendingStatusDataBuilder(),
    failedStatusDataBuilder(),
  ]);
}
