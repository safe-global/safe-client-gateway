import { faker } from '@faker-js/faker/.';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import type { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';

export function walletBuilder(): IBuilder<Wallet> {
  return new Builder<Wallet>()
    .with('id', faker.number.int())
    .with('user', userBuilder().build())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
