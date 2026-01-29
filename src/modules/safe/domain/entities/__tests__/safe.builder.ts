import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Safe, SafeV2 } from '@/modules/safe/domain/entities/safe.entity';
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

export function safeV2Builder(): IBuilder<SafeV2> {
  return new Builder<SafeV2>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('owners', [getAddress(faker.finance.ethereumAddress())])
    .with('threshold', faker.number.int({ min: 1 }))
    .with('nonce', faker.number.int({ min: 0 }))
    .with('masterCopy', getAddress(faker.finance.ethereumAddress()))
    .with('fallbackHandler', getAddress(faker.finance.ethereumAddress()))
    .with('guard', getAddress(faker.finance.ethereumAddress()))
    .with('moduleGuard', getAddress(faker.finance.ethereumAddress()))
    .with('enabledModules', [getAddress(faker.finance.ethereumAddress())]);
}
