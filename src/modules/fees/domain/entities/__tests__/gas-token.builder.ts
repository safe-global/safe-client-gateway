// SPDX-License-Identifier: FSL-1.1-MIT
import { faker } from '@faker-js/faker';
import { getAddress } from 'viem';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { GasToken } from '@/modules/fees/domain/entities/gas-token.entity';

export function gasTokenBuilder(): IBuilder<GasToken> {
  return new Builder<GasToken>()
    .with('address', getAddress(faker.finance.ethereumAddress()))
    .with('symbol', faker.finance.currencyCode());
}
