import { faker } from '@faker-js/faker';
import { Contract } from '../contract.entity';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function contractBuilder(): IBuilder<Contract> {
  return Builder.new<Contract>()
    .with('address', faker.finance.ethereumAddress())
    .with('name', faker.random.word())
    .with('displayName', faker.random.words())
    .with('logoUri', faker.internet.url())
    .with('contractAbi', JSON.parse(faker.datatype.json()))
    .with('trustedForDelegateCall', faker.datatype.boolean());
}
