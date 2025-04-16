import { type IBuilder, Builder } from '@/__tests__/builder';
import type {
  AddressBook,
  AddressBookItem,
} from '@/domain/accounts/address-books/entities/address-book.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function addressBookItemBuilder(): IBuilder<AddressBookItem> {
  return new Builder<AddressBookItem>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('name', nameBuilder());
}

export function addressBookBuilder(): IBuilder<AddressBook> {
  return new Builder<AddressBook>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('accountId', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('chainId', faker.string.numeric({ length: 6 }))
    .with(
      'data',
      faker.helpers.multiple(() => addressBookItemBuilder().build(), {
        count: { min: 1, max: 5 },
      }),
    )
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
