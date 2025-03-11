import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Safe } from '@/domain/safe/entities/safe.entity';
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
    .with(
      'version',
      faker.helpers.arrayElement([
        '1.0.0',
        '1.1.1',
        '1.2.0',
        '1.3.0',
        '1.4.0',
        '1.4.1',
      ]),
    );
}
