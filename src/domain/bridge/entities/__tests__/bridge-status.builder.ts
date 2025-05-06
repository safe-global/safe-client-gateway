import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import { Builder } from '@/__tests__/builder';
import {
  StatusMessages,
  SubstatusesDone,
  SubstatusesFailed,
  SubstatusesPending,
} from '@/domain/bridge/entities/bridge-status.entity';
import type { IBuilder } from '@/__tests__/builder';
import type {
  BaseTransactionInfo,
  BridgeStatus,
  ExtendedTransactionInfo,
  FailedStatusData,
  FullStatusData,
  IncludedStep,
  PendingReceivingInfo,
  SetupToolDetails,
  StatusData,
  TransferMetadata,
} from '@/domain/bridge/entities/bridge-status.entity';
import { tokenBuilder } from '@/domain/bridge/entities/__tests__/token.builder';
import { feeCostBuilder } from '@/domain/bridge/entities/__tests__/fee-cost.builder';

export function baseStatusDataBuilder<
  T extends FullStatusData | StatusData | FailedStatusData,
>(): IBuilder<T> {
  return new Builder<T>()
    .with('status', faker.helpers.arrayElement(StatusMessages))
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
    .with('txHash', faker.string.hexadecimal({ length: 64 }) as `0x${string}`)
    .with('chainId', faker.string.numeric())
    .with('txLink', faker.internet.url({ appendSlash: false }));
}

export function setupToolDetailsBuilder(): IBuilder<SetupToolDetails> {
  return new Builder<SetupToolDetails>()
    .with('key', faker.word.sample())
    .with('name', faker.word.sample())
    .with('logoURI', faker.internet.url({ appendSlash: false }));
}

export function includedStepBuilder(): IBuilder<IncludedStep> {
  return new Builder<IncludedStep>()
    .with('fromAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('fromToken', tokenBuilder().build())
    .with('toAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('toToken', tokenBuilder().build())
    .with(
      'bridgedAmount',
      faker.number.float({ min: 0, max: 1_000 }).toString(),
    )
    .with('tool', faker.word.sample())
    .with('toolDetails', setupToolDetailsBuilder().build());
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
    .with('amountUSD', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('token', tokenBuilder().build())
    .with('gasPrice', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('gasUsed', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('gasToken', tokenBuilder().build())
    .with('gasAmount', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('gasAmountUSD', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with('timestamp', faker.number.int())
    .with('value', faker.number.float({ min: 0, max: 1_000 }).toString())
    .with(
      'includedSteps',
      faker.helpers.multiple(() => includedStepBuilder().build(), {
        count: { min: 1, max: 5 },
      }),
    );
}

export function transferMetadataBuilder(): IBuilder<TransferMetadata> {
  return new Builder<TransferMetadata>().with(
    'integrator',
    faker.word.sample(),
  );
}

export function fullStatusDataBuilder<
  T extends FullStatusData = FullStatusData,
>(): IBuilder<T> {
  return baseStatusDataBuilder<T>()
    .with(
      'transactionId',
      faker.string.hexadecimal({ length: 64 }) as `0x${string}`,
    )
    .with('sending', extendedTransactionInfoBuilder().build())
    .with(
      'receiving',
      faker.helpers
        .arrayElement([
          pendingReceivingInfoBuilder(),
          extendedTransactionInfoBuilder(),
        ])
        .build(),
    )
    .with(
      'feeCosts',
      faker.helpers.multiple(() => feeCostBuilder().build(), {
        count: { min: 1, max: 5 },
      }),
    )
    .with('lifiExplorerLink', faker.internet.url({ appendSlash: false }))
    .with('fromAddress', getAddress(faker.finance.ethereumAddress()))
    .with('toAddress', getAddress(faker.finance.ethereumAddress()))
    .with('metadata', transferMetadataBuilder().build())
    .with('bridgeExplorerLink', faker.internet.url({ appendSlash: false }));
}

export function statusDataBuilder<
  T extends StatusData = StatusData,
>(): IBuilder<T> {
  return baseStatusDataBuilder<T>()
    .with('tool', faker.word.sample())
    .with('sending', baseTransactionInfoBuilder().build())
    .with('receiving', pendingReceivingInfoBuilder().build());
}

export function failedStatusDataBuilder<
  T extends FailedStatusData = FailedStatusData,
>(): IBuilder<T> {
  return baseStatusDataBuilder<T>()
    .with('status', 'FAILED')
    .with('sending', baseTransactionInfoBuilder().build());
}

export function bridgeStatusBuilder(): IBuilder<BridgeStatus> {
  return faker.helpers.arrayElement([
    fullStatusDataBuilder(),
    statusDataBuilder(),
    failedStatusDataBuilder(),
  ]);
}
