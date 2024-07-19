import { Builder, IBuilder } from '@/__tests__/builder';
import { Account } from '@/domain/accounts/entities/account.entity';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function accountBuilder(): IBuilder<Account> {
  return new Builder<Account>()
    .with('id', faker.number.int({ max: Number.MAX_SAFE_INTEGER }))
    .with('group_id', faker.number.int({ max: Number.MAX_SAFE_INTEGER }))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
