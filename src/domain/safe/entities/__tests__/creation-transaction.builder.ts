import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CreationTransaction } from '@/domain/safe/entities/creation-transaction.entity';
import { getAddress } from 'viem';

export function creationTransactionBuilder(): IBuilder<CreationTransaction> {
  return new Builder<CreationTransaction>()
    .with('created', faker.date.recent())
    .with('creator', getAddress(faker.finance.ethereumAddress()))
    .with('transactionHash', faker.string.hexadecimal() as `0x${string}`)
    .with('factoryAddress', getAddress(faker.finance.ethereumAddress()))
    .with('masterCopy', getAddress(faker.finance.ethereumAddress()))
    .with('setupData', faker.string.hexadecimal() as `0x${string}`)
    .with('saltNonce', faker.string.numeric());
}

export function toJson(creationTransaction: CreationTransaction): unknown {
  return {
    ...creationTransaction,
    created: creationTransaction.created.toISOString(),
  };
}
