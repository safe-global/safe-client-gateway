import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { CreationTransaction } from '../creation-transaction.entity';
import { dataDecodedBuilder } from '../../../data-decoder/entities/__tests__/data-decoded.builder';

export function creationTransactionBuilder(): IBuilder<CreationTransaction> {
  return Builder.new<CreationTransaction>()
    .with('created', faker.date.recent())
    .with('creator', faker.finance.ethereumAddress())
    .with('transactionHash', faker.string.hexadecimal())
    .with('factoryAddress', faker.finance.ethereumAddress())
    .with('masterCopy', faker.finance.ethereumAddress())
    .with('setupData', faker.string.hexadecimal())
    .with('dataDecoded', dataDecodedBuilder().build());
}

export function toJson(creationTransaction: CreationTransaction): unknown {
  return {
    ...creationTransaction,
    created: creationTransaction.created.toISOString(),
  };
}
