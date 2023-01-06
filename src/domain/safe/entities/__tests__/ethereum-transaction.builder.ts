import { EthereumTransaction } from '../ethereum-transaction.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function ethereumTransactionBuilder(): IBuilder<EthereumTransaction> {
  return Builder.new<EthereumTransaction>()
    .with('blockNumber', faker.datatype.number())
    .with('data', faker.datatype.hexadecimal())
    .with('executionDate', faker.date.recent())
    .with('from', faker.finance.ethereumAddress())
    .with('transfers', [])
    .with('txHash', faker.datatype.hexadecimal());
}
