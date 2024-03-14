import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { fakeJson } from '@/__tests__/faker';
import { Contract } from '@/domain/contracts/entities/contract.entity';
import { getAddress } from 'viem';

export function contractBuilder(): IBuilder<Contract> {
  return new Builder<Contract>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', faker.word.sample())
    .with('displayName', faker.word.words())
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('contractAbi', JSON.parse(fakeJson()))
    .with('trustedForDelegateCall', faker.datatype.boolean());
}
