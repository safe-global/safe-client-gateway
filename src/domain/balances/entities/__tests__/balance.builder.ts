import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '@/__tests__/builder';
import { balanceTokenBuilder } from '@/domain/balances/entities/__tests__/balance.token.builder';
import { Balance } from '@/domain/balances/entities/balance.entity';

export function balanceBuilder(): IBuilder<Balance> {
  return Builder.new<Balance>()
    .with('tokenAddress', faker.finance.ethereumAddress())
    .with('token', balanceTokenBuilder().build())
    .with('balance', faker.string.numeric())
    .with('fiatBalance', faker.string.numeric())
    .with('fiatConversion', faker.string.numeric());
}
