import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AddressInfo } from '@/routes/common/entities/address-info.entity';

export function addressInfoBuilder(): IBuilder<AddressInfo> {
  return new Builder<AddressInfo>()
    .with('value', faker.finance.ethereumAddress())
    .with('name', faker.word.words())
    .with('logoUri', faker.internet.url({ appendSlash: false }));
}
