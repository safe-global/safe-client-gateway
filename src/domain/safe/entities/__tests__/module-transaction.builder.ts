import { faker } from '@faker-js/faker';
import { dataDecodedBuilder } from '@/domain/data-decoder/entities/__tests__/data-decoded.builder';
import { Builder, IBuilder } from '@/__tests__/builder';
import { ModuleTransaction } from '@/domain/safe/entities/module-transaction.entity';
import { getAddress } from 'viem';

export function moduleTransactionBuilder(): IBuilder<ModuleTransaction> {
  return new Builder<ModuleTransaction>()
    .with('blockNumber', faker.number.int())
    .with('created', faker.date.recent())
    .with('data', faker.string.hexadecimal() as `0x${string}`)
    .with('dataDecoded', dataDecodedBuilder().build())
    .with('executionDate', faker.date.recent())
    .with('isSuccessful', faker.datatype.boolean())
    .with('module', getAddress(faker.finance.ethereumAddress()))
    .with('operation', faker.helpers.arrayElement([0, 1]))
    .with('safe', getAddress(faker.finance.ethereumAddress()))
    .with('to', getAddress(faker.finance.ethereumAddress()))
    .with('transactionHash', faker.string.hexadecimal() as `0x${string}`)
    .with('value', faker.string.hexadecimal())
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
