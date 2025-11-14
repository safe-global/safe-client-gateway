import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { TransactionStatus } from '@/modules/staking/datasources/entities/transaction-status.entity';
import { faker } from '@faker-js/faker';
import type { Address, Hex } from 'viem';

export function transactionStatusReceiptLogBuilder(): IBuilder<
  TransactionStatus['receipt']['logs'][number]
> {
  return new Builder<TransactionStatus['receipt']['logs'][number]>()
    .with(
      'topics',
      Array.from({ length: faker.number.int({ min: 1, max: 10 }) }, () => {
        return faker.string.hexadecimal({ length: 64 }) as Hex;
      }) as [Address, ...Array<Address>],
    )
    .with(
      'data',
      faker.string.hexadecimal({
        length: 64,
      }) as Address,
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
