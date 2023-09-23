import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { AddressInfo } from '../../entities/address-info.entity';

export function addressInfoBuilder(): IBuilder<AddressInfo> {
  return Builder.new<AddressInfo>()
    .with('value', faker.finance.ethereumAddress())
    .with('name', faker.word.words())
    .with('logoUri', faker.internet.url({ appendSlash: false }));
}
