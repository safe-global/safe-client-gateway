// SPDX-License-Identifier: FSL-1.1-MIT
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker/.';
import type { Wallet } from '@/modules/wallets/datasources/entities/wallets.entity.db';
import { userBuilder } from '@/modules/users/datasources/entities/__tests__/users.entity.db.builder';
import { getAddress } from 'viem';

export function walletBuilder(): IBuilder<Wallet> {
  return new Builder<Wallet>()
    .with('id', faker.number.int())
    .with('user', userBuilder().build())
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('createdAt', new Date())
    .with('updatedAt', new Date());
}
