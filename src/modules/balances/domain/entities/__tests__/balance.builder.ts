// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import { balanceTokenBuilder } from '@/modules/balances/domain/entities/__tests__/balance.token.builder';
import type { Balance } from '@/modules/balances/domain/entities/balance.entity';

export function balanceBuilder(): IBuilder<Balance> {
  return new Builder<Balance>()
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('token', balanceTokenBuilder().build())
    .with('balance', faker.string.numeric())
    .with('fiatBalance', null)
    .with('fiatConversion', null)
    .with('fiatBalance24hChange', null);
}
