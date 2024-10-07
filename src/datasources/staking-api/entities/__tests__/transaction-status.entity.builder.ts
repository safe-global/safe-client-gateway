import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { TransactionStatus } from '@/datasources/staking-api/entities/transaction-status.entity';
import { faker } from '@faker-js/faker';

export function transactionStatusReceiptLogBuilder(): IBuilder<
  TransactionStatus['receipt']['logs'][number]
> {
  return new Builder<TransactionStatus['receipt']['logs'][number]>()
    .with(
      'topics',
      Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () => {
        return faker.string.hexadecimal({ length: 64 }) as `0x${string}`;
      }) as [`0x${string}`, ...Array<`0x${string}`>],
    )
    .with(
      'data',
      faker.string.hexadecimal({
        length: 64,
      }) as `0x${string}`,
    );
}

export function transactionStatusReceiptBuilder(): IBuilder<
  TransactionStatus['receipt']
> {
  return new Builder<TransactionStatus['receipt']>().with(
    'logs',
    Array.from({ length: faker.number.int({ min: 0, max: 10 }) }, () =>
      transactionStatusReceiptLogBuilder().build(),
    ),
  );
}

export function transactionStatusBuilder(): IBuilder<TransactionStatus> {
  const receipt = transactionStatusReceiptBuilder().build();
  return new Builder<TransactionStatus>().with('receipt', receipt);
}
