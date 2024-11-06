import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { accountNameBuilder } from '@/domain/accounts/entities/__tests__/account-name.builder';
import type { Account } from '@/domain/accounts/entities/account.entity';
import { DB_MAX_SAFE_INTEGER } from '@/domain/common/constants';
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';

export function accountBuilder(): IBuilder<Account> {
  return new Builder<Account>()
    .with('id', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('group_id', faker.number.int({ max: DB_MAX_SAFE_INTEGER }))
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('name', accountNameBuilder())
    .with('created_at', faker.date.recent())
    .with('updated_at', faker.date.recent());
}
