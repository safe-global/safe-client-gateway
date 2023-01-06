import { BalanceToken } from '../balance.token.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';

export function balanceTokenBuilder(): IBuilder<BalanceToken> {
  return Builder.new<BalanceToken>()
    .with('decimals', faker.datatype.number())
    .with('logoUri', faker.internet.url())
    .with('name', faker.finance.currencyName())
    .with('symbol', faker.finance.currencySymbol());
}
