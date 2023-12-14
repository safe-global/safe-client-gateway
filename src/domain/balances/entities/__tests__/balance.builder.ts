import { Builder, IBuilder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import { balanceTokenBuilder } from './balance.token.builder';
import { Balance } from '@/domain/balances/entities/balance.entity';

export function balanceBuilder(): IBuilder<Balance> {
  return Builder.new<Balance>()
    .with('tokenAddress', faker.finance.ethereumAddress())
    .with('token', balanceTokenBuilder().build())
    .with('balance', faker.string.numeric());
}
