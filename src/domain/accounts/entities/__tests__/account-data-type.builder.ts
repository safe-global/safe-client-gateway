import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { AccountDataTypeNames } from '@/domain/accounts/entities/account-data-type.entity';
import { faker } from '@faker-js/faker';

export function accountDataTypeBuilder(): IBuilder<AccountDataType> {
  return new Builder<AccountDataType>()
    .with('id', faker.number.int())
    .with(
      'name',
      faker.helpers.arrayElement([
        AccountDataTypeNames.CounterfactualSafes,
        AccountDataTypeNames.AddressBook,
        AccountDataTypeNames.Watchlist,
      ]),
    )
    .with('description', faker.lorem.slug())
    .with('is_active', faker.datatype.boolean())
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
