import { Builder, type IBuilder } from '@/__tests__/builder';
import type { CreateAddressBookItemDto } from '@/domain/accounts/address-books/entities/create-address-book-item.dto.entity';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function createAddressBookItemDtoBuilder(): IBuilder<CreateAddressBookItemDto> {
  return new Builder<CreateAddressBookItemDto>()
    .with('name', nameBuilder())
    .with('address', getAddress(faker.finance.ethereumAddress()));
}
