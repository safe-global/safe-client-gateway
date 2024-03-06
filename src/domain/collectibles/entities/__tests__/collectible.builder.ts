import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { Collectible } from '@/domain/collectibles/entities/collectible.entity';
import { getAddress } from 'viem';

export function collectibleBuilder(): IBuilder<Collectible> {
  return new Builder<Collectible>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('tokenName', faker.company.name())
    .with('tokenSymbol', faker.finance.currencySymbol())
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('id', faker.string.uuid())
    .with('uri', faker.internet.url({ appendSlash: false }))
    .with('name', faker.company.name())
    .with('description', faker.word.words())
    .with('imageUri', faker.internet.url({ appendSlash: false }))
    .with('metadata', {});
}
