import { Safe } from '../safe.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';

export function safeBuilder(): IBuilder<Safe> {
  return Builder.new<Safe>()
    .with('address', faker.finance.ethereumAddress())
    .with('nonce', faker.number.int())
    .with('threshold', faker.number.int())
    .with('owners', [faker.finance.ethereumAddress()])
    .with('masterCopy', faker.finance.ethereumAddress())
    .with('modules', null)
    .with('fallbackHandler', faker.finance.ethereumAddress())
    .with('guard', faker.finance.ethereumAddress())
    .with('version', faker.system.semver());
}
