import { Collectible } from '../collectible.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function collectibleBuilder(): IBuilder<Collectible> {
  return Builder.new<Collectible>()
    .with('address', faker.finance.ethereumAddress())
    .with('tokenName', faker.company.name())
    .with('tokenSymbol', faker.finance.currencySymbol())
    .with('logoUri', faker.internet.url())
    .with('id', faker.datatype.uuid())
    .with('uri', faker.internet.url())
    .with('name', faker.company.name())
    .with('description', faker.random.words())
    .with('imageUri', faker.internet.url())
    .with('metadata', {});
}
