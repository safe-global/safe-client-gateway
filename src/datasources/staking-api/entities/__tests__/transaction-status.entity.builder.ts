import { Builder, IBuilder } from '@/__tests__/builder';
import { TransactionStatus } from '@/datasources/staking-api/entities/transaction-status.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function transactionStatusReceiptLogBuilder(): IBuilder<
  TransactionStatus['receipt']['logs'][number]
> {
  return new Builder<TransactionStatus['receipt']['logs'][number]>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with(
      'topics',
      Array.from({ length: faker.number.int({ min: 0, max: 10 }) }, () => {
        return faker.string.hexadecimal({ length: 64 }) as `0x${string}`;
      }),
    )
    .with(
      'data',
      faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`,
    )
    .with(
      'blockHash',
      faker.string.hexadecimal({ length: 64 }) as `0x${string}`,
    )
    .with('blockNumber', faker.string.numeric())
    .with(
      'blockTimestamp',
      faker.string.hexadecimal({ length: 8 }) as `0x${string}`,
    )
    .with(
      'transactionHash',
      faker.string.hexadecimal({ length: 64 }) as `0x${string}`,
    )
    .with('transactionIndex', faker.number.int())
    .with('logIndex', faker.number.int())
    .with('removed', false);
}

export function transactionStatusReceiptBuilder(): IBuilder<
  TransactionStatus['receipt']
> {
  const transactionIndex = faker.number.int();
  return new Builder<TransactionStatus['receipt']>()
    .with('status', 'success')
    .with('cumulativeGasUsed', faker.string.numeric())
    .with(
      'logs',
      Array.from({ length: faker.number.int({ min: 0, max: 10 }) }, () =>
        transactionStatusReceiptLogBuilder()
          .with('transactionIndex', transactionIndex)
          .build(),
      ),
    )
    .with(
      'logsBloom',
      faker.string.hexadecimal({ length: 512 }) as `0x${string}`,
    )
    .with('type', 'eip1559')
    .with(
      'transactionHash',
      faker.string.hexadecimal({ length: 64 }) as `0x${string}`,
    )
    .with('transactionIndex', transactionIndex)
    .with(
      'blockHash',
      faker.string.hexadecimal({ length: 64 }) as `0x${string}`,
    )
    .with('blockNumber', faker.string.numeric())
    .with('gasUsed', faker.string.numeric())
    .with('effectiveGasPrice', faker.string.numeric())
    .with('from', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('contractAddress', null);
}

export function transactionStatusBuilder(): IBuilder<TransactionStatus> {
  const receipt = transactionStatusReceiptBuilder().build();
  return new Builder<TransactionStatus>()
    .with('receipt', receipt)
    .with('status', receipt.status);
}
