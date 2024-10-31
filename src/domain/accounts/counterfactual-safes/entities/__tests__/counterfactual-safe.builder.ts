import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { CounterfactualSafe } from '@/domain/accounts/counterfactual-safes/entities/counterfactual-safe.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function counterfactualSafeBuilder(): IBuilder<CounterfactualSafe> {
  return new Builder<CounterfactualSafe>()
    .with('chain_id', faker.string.numeric({ length: 6 }))
    .with('creator', getAddress(faker.finance.ethereumAddress()))
    .with('fallback_handler', getAddress(faker.finance.ethereumAddress()))
    .with(
      'owners',
      Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
        getAddress(faker.finance.ethereumAddress()),
      ),
    )
    .with('predicted_address', getAddress(faker.finance.ethereumAddress()))
    .with('salt_nonce', faker.string.hexadecimal())
    .with('singleton_address', getAddress(faker.finance.ethereumAddress()))
    .with('threshold', faker.number.int({ min: 1, max: 10 }))
    .with('account_id', faker.number.int());
}
