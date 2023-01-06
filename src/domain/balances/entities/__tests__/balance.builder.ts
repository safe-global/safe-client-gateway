import { Balance } from '../balance.entity';
import { faker } from '@faker-js/faker';
import { Builder, IBuilder } from '../../../../__tests__/builder';
import { balanceTokenBuilder } from './balance.token.builder';

export function balanceBuilder(): IBuilder<Balance> {
  return Builder.new<Balance>()
    .with('tokenAddress', faker.finance.ethereumAddress())
    .with('token', balanceTokenBuilder().build())
    .with('balance', faker.random.numeric())
    .with('fiatBalance', faker.random.numeric())
    .with('fiatConversion', faker.random.numeric());
}
