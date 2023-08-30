import { EthereumTransaction } from '../ethereum-transaction.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';

export function ethereumTransactionBuilder(): IBuilder<EthereumTransaction> {
  return Builder.new<EthereumTransaction>()
    .with('blockNumber', faker.number.int())
    .with('data', faker.string.hexadecimal())
    .with('executionDate', faker.date.recent())
    .with('from', faker.finance.ethereumAddress())
    .with('transfers', [])
    .with('txHash', faker.string.hexadecimal());
}

export function toJson(ethereumTransaction: EthereumTransaction): unknown {
  return {
    ...ethereumTransaction,
    txType: 'ETHEREUM_TRANSACTION',
    executionDate: ethereumTransaction.executionDate.toISOString(),
  };
}
