// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { Builder } from '@/__tests__/builder';
import type * as Tx from '@/modules/safenet/domain/entities/safenet-safe-transaction.entity';
import { AddressSchema } from '@/validation/entities/schemas/address.schema';

export function safenetSafeTransactionBuilder(): Builder<Tx.SafenetSafeTransaction> {
  return new Builder<Tx.SafenetSafeTransaction>()
    .with('chainId', faker.number.bigInt({ min: 1n, max: 1000n }))
    .with('safe', AddressSchema.parse(faker.finance.ethereumAddress()))
    .with('to', AddressSchema.parse(faker.finance.ethereumAddress()))
    .with('value', faker.number.bigInt({ min: 0n, max: 100n }))
    .with('data', '0x')
    .with('operation', 0)
    .with('safeTxGas', faker.number.bigInt({ min: 1n, max: 100n }))
    .with('baseGas', faker.number.bigInt({ min: 1n, max: 100n }))
    .with('gasPrice', faker.number.bigInt({ min: 1n, max: 100n }))
    .with('gasToken', AddressSchema.parse(faker.finance.ethereumAddress()))
    .with(
      'refundReceiver',
      AddressSchema.parse(faker.finance.ethereumAddress()),
    )
    .with('nonce', faker.number.bigInt({ min: 1n, max: 100n }));
}
