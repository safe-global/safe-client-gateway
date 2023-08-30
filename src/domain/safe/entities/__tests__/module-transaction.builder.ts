import { faker } from '@faker-js/faker';
import { dataDecodedBuilder } from '../../../data-decoder/entities/__tests__/data-decoded.builder';
import { Builder, IBuilder } from '@/__tests__/builder';
import { ModuleTransaction } from '../module-transaction.entity';

export function moduleTransactionBuilder(): IBuilder<ModuleTransaction> {
  return Builder.new<ModuleTransaction>()
    .with('blockNumber', faker.number.int())
    .with('created', faker.date.recent())
    .with('data', faker.string.hexadecimal())
    .with('dataDecoded', dataDecodedBuilder().build())
    .with('executionDate', faker.date.recent())
    .with('isSuccessful', faker.datatype.boolean())
    .with('module', faker.finance.ethereumAddress())
    .with('operation', faker.helpers.arrayElement([0, 1]))
    .with('safe', faker.finance.ethereumAddress())
    .with('to', faker.finance.ethereumAddress())
    .with('transactionHash', faker.string.hexadecimal())
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
