import { Builder, IBuilder } from '@/__tests__/builder';
import { SiweMessage } from '@/domain/siwe/entities/siwe-message.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function siweMessageBuilder(): IBuilder<SiweMessage> {
  return new Builder<SiweMessage>()
    .with('scheme', faker.internet.protocol())
    .with('domain', faker.internet.domainName())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('statement', faker.lorem.sentence())
    .with('uri', faker.internet.url({ appendSlash: false }))
    .with('version', '1')
    .with('chainId', faker.number.int({ min: 1 }))
    .with('nonce', faker.string.alphanumeric({ length: 8 }))
    .with('issuedAt', faker.date.recent().toISOString())
    .with('expirationTime', faker.date.future().toISOString())
    .with('notBefore', faker.date.past().toISOString())
    .with('requestId', faker.string.uuid())
    .with(
      'resources',
      Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () =>
        faker.internet.url({ appendSlash: false }),
      ),
    );
}
