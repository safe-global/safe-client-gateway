import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Safe } from '@/domain/safe/entities/safe.entity';
import { getAddress } from 'viem';

export function safeBuilder(): IBuilder<Safe> {
  return new Builder<Safe>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('nonce', faker.number.int())
    .with('threshold', faker.number.int())
    .with('owners', [getAddress(faker.finance.ethereumAddress())])
    .with('masterCopy', getAddress(faker.finance.ethereumAddress()))
    .with('modules', null)
    .with('fallbackHandler', getAddress(faker.finance.ethereumAddress()))
    .with('guard', getAddress(faker.finance.ethereumAddress()))
    .with('version', faker.system.semver());
}
