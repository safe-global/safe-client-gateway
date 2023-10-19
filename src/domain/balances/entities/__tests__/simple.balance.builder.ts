import { Builder, IBuilder } from '@/__tests__/builder';
import { faker } from '@faker-js/faker';
import { SimpleBalance } from '../simple-balance.entity';
import { balanceTokenBuilder } from './balance.token.builder';

export function simpleBalanceBuilder(): IBuilder<SimpleBalance> {
  return Builder.new<SimpleBalance>()
    .with('tokenAddress', faker.finance.ethereumAddress())
    .with('token', balanceTokenBuilder().build())
    .with('balance', faker.string.numeric());
}
