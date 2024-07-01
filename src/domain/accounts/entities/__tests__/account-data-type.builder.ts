import { Builder, IBuilder } from '@/__tests__/builder';
import { AccountDataType } from '@/domain/accounts/entities/account-data-type.entity';
import { faker } from '@faker-js/faker';

export function accountDataTypeBuilder(): IBuilder<AccountDataType> {
  return new Builder<AccountDataType>()
    .with('id', faker.number.int())
    .with('name', faker.lorem.slug())
    .with('description', faker.lorem.slug())
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
