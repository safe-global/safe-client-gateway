import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AddressBookItem } from '@/datasources/spaces/entities/address-book-item.entity.db';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { spaceBuilder } from '@/domain/spaces/entities/__tests__/space.entity.db.builder';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function addressBookItemBuilder(): IBuilder<AddressBookItem> {
  return new Builder<AddressBookItem>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('space', spaceBuilder().build())
    .with(
      'chainIds',
      faker.helpers.multiple(() => faker.string.numeric(), {
        count: { min: 1, max: 5 },
      }),
    )
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', nameBuilder())
    .with('createdBy', getAddress(faker.finance.ethereumAddress()))
    .with('lastUpdatedBy', getAddress(faker.finance.ethereumAddress()));
}
