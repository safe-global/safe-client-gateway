import { Builder, type IBuilder } from '@/__tests__/builder';
import type { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { accountNameBuilder } from '@/domain/accounts/entities/__tests__/account-name.builder';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function createAddressBookItemDtoBuilder(): IBuilder<CreateAddressBookItemDto> {
  return new Builder<CreateAddressBookItemDto>()
    .with('name', accountNameBuilder())
    .with('address', getAddress(faker.finance.ethereumAddress()));
}
