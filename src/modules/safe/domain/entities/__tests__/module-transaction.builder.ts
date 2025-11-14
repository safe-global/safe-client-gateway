import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { ModuleTransaction } from '@/modules/safe/domain/entities/module-transaction.entity';
import { getAddress, type Hash, type Hex } from 'viem';

export function moduleTransactionBuilder(): IBuilder<ModuleTransaction> {
  return new Builder<ModuleTransaction>()
    .with('blockNumber', faker.number.int())
    .with('created', faker.date.recent())
    .with('data', faker.string.hexadecimal() as Hex)
    .with('executionDate', faker.date.recent())
    .with('isSuccessful', faker.datatype.boolean())
    .with('module', getAddress(faker.finance.ethereumAddress()))
    .with('operation', faker.helpers.arrayElement([0, 1]))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('transactionHash', faker.string.hexadecimal() as Hash)
    .with('value', faker.string.numeric())
    .with('moduleTransactionId', faker.string.sample());
}

export function toJson(moduleTransaction: ModuleTransaction): unknown {
  return {
    ...moduleTransaction,
    txType: 'MODULE_TRANSACTION',
    created: moduleTransaction.created.toISOString(),
    executionDate: moduleTransaction.executionDate.toISOString(),
  };
}
