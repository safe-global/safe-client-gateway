import { Builder, IBuilder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';
import { Balance } from '@/domain/balances/entities/balance.entity';
import { getAddress } from 'viem';

export function balanceBuilder(): IBuilder<Balance> {
  return new Builder<Balance>()
    .with('tokenAddress', getAddress(faker.finance.ethereumAddress()))
    .with('token', balanceTokenBuilder().build())
    .with('balance', faker.string.numeric());
}
