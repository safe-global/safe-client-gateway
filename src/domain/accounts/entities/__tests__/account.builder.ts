import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { Account } from '@/domain/accounts/entities/account.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { nameBuilder } from '@/domain/common/entities/name.builder';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function accountBuilder(): IBuilder<Account> {
  return new Builder<Account>()
    .with('id', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('group_id', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', nameBuilder())
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
