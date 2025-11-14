import { faker } from '@faker-js/faker';
import type { IBuilder } from '@/__tests__/builder';
import { Builder } from '@/__tests__/builder';
import type { BalanceToken } from '@/modules/balances/domain/entities/balance.token.entity';

export function balanceTokenBuilder(): IBuilder<BalanceToken> {
  return new Builder<BalanceToken>()
    .with('decimals', faker.number.int())
    .with('logoUri', faker.internet.url({ appendSlash: false }))
    .with('name', faker.finance.currencyName())
    .with('symbol', faker.finance.currencySymbol());
}
