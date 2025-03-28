import { Builder, type IBuilder } from '@/__tests__/builder';
import type { UpdateAddressBookItemDto } from '@/domain/accounts/address-books/entities/update-address-book.item.dto.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';

export function updateAddressBookItemDtoBuilder(): IBuilder<UpdateAddressBookItemDto> {
  return new Builder<UpdateAddressBookItemDto>()
    .with('id', faker.number.int({ min: 1, max: DB_MAX_SAFE_INTEGER }))
    .with('name', nameBuilder())
    .with('address', getAddress(faker.finance.ethereumAddress()));
}
