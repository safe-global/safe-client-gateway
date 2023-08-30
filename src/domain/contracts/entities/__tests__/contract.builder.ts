import { faker } from '@faker-js/faker';
import { Contract } from '../contract.entity';
import { Builder, IBuilder } from '@/__tests__/builder';
import { fakeJson } from '@/__tests__/faker';

export function contractBuilder(): IBuilder<Contract> {
  return Builder.new<Contract>()
    .with('address', faker.finance.ethereumAddress())
    .with('name', faker.word.sample())
    .with('displayName', faker.word.words())
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('contractAbi', JSON.parse(fakeJson()))
    .with('trustedForDelegateCall', faker.datatype.boolean());
}
